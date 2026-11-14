import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { GameCard } from '../../shared/game-card/game-card';
import { GameModel } from '../../core/models/game.model';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime, map, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FilterState, toFilterParams } from '../../core/models/game-filter.model';
import { GameFilters } from '../../shared/game-filters/game-filters';
import { ScrollControls } from '../../shared/scroll-controls/scroll-controls';
import { GamesData } from './games-data';
import { GamesFavorites } from './games-favorites';

@Component({
  imports: [GameCard, FormsModule, GameFilters, ScrollControls],
  providers: [GamesData, GamesFavorites],
  selector: 'app-games',
  styleUrl: './games.scss',
  templateUrl: './games.html',
})

export class Games implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(GamesData);
  private readonly favorites = inject(GamesFavorites);
  private readonly filtersPanel = viewChild(GameFilters);
  private readonly searchTyped = new Subject<string>();
  private readonly loginDialog = viewChild<ElementRef<HTMLDialogElement>>('loginDialog');



  loginPrompt = signal<GameModel | null>(null);
  searchInput = '';
  readonly favoriteIds = this.favorites.favoriteIds;
  readonly isLoggedIn = this.favorites.isLoggedIn;
  readonly favoritesReady = this.favorites.ready;
  readonly favoriteBusyIds = this.favorites.busyIds;
  readonly favoriteError = this.favorites.error;
  readonly pageSize = this.data.pageSize;
  readonly games = this.data.games;
  readonly currentPage = this.data.currentPage;
  readonly totalPages = this.data.totalPages;
  readonly totalGames = this.data.totalGames;
  readonly loading = this.data.loading;
  readonly error = this.data.error;
  readonly searchTerm = this.data.searchTerm;
  readonly filterState = this.data.filterState;

  readonly hasActiveFilters = computed(() =>
    Object.values(toFilterParams(this.filterState()))
      .some(value => value !== null)
  );

  ngOnInit(): void {
    this.searchTyped.pipe(
      map(value => value.trim()),
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(search => {
      if (search === this.searchTerm()) return;

      void this.router.navigate(['/games'], {
        queryParams: this.searchParams(search),
        queryParamsHandling: 'merge'
      });
    });

    this.data.initialize(search => {
      if (this.searchInput.trim() !== search) {
        this.searchInput = search;
      }
    });
  }

  // updates page and let URL stream reload
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    if (page === this.currentPage()) return;

    void this.router.navigate(['/games'], {
      queryParams: {
        page: page === 1 ? null : page
      },
      queryParamsHandling: 'merge'
    });
  }

  readonly pageNumbers = computed<(number | '...')[]>(() => {
    const current = this.currentPage();
    const total = this.totalPages();

    const pages = new Set<number>([1, total]);

    for (let page = current - 2; page <= current + 2; page++) {
      if (page >= 1 && page <= total) {
        pages.add(page);
      }
    }

    const sorted = [...pages]
      .filter(page => page >= 1 && page <= total)
      .sort((a, b) => a - b);

    const result: (number | '...')[] = [];

    sorted.forEach((page, index) => {
      const previous = sorted[index - 1];

      if (index > 0 && page - previous > 1) {
        result.push('...');
      }

      result.push(page);
    });

    return result;
  });

  toggleFavorite(id: number): void {
    if (!this.isLoggedIn()) {
      this.openLoginPrompt(id);
      return;
    }

    this.favorites.toggle(id);
  }

  private openLoginPrompt(id: number): void {
    const game = this.games().find(g => g.id === id) ?? null;
    this.loginPrompt.set(game);
    this.loginDialog()?.nativeElement.showModal();
  }

  goToLogin(): void {
    const game = this.loginPrompt();
    if (!game) return;

    this.favorites.goToLogin(game.id);
  }

  private searchParams(search: string) {
    const wasSearching = this.searchTerm() !== '';

    if (search && !wasSearching) {
      const page = this.currentPage();
      return { search, page: null, fromPage: page > 1 ? page : null };
    }
    if (!search && wasSearching) {
      return {
        search: null,
        page: readFromPage(this.route.snapshot.queryParamMap),
        fromPage: null
      };
    }
    return { search: search || null, page: null };
  }

  submitSearch(): void {
    const search = this.searchInput.trim();
    const draft = this.filtersPanel()?.filterState ?? this.filterState();

    void this.router.navigate(['/games'], {
      queryParams: {
        ...this.searchParams(search),
        ...toFilterParams(draft)
      },
      queryParamsHandling: 'merge'
    });
  }
  onSearchInput(value: string): void {
    this.searchTyped.next(value);
  }

  retryGames(): void {
    this.data.retry();
  }

  submitFilters(state: FilterState): void {
    void this.router.navigate(['/games'], {
      queryParams: {
        ...toFilterParams(state),
        page: null,
        fromPage: null
      },
      queryParamsHandling: 'merge'
    });
  }
  resetFilters(): void {
    void this.router.navigate(['/games'], {
      queryParams: { search: this.searchTerm() || null }
    });
  }
}

function readFromPage(params: ParamMap): number | null {
  const page = Number(params.get('fromPage'));
  return Number.isSafeInteger(page) && page > 1 ? page : null;
}
