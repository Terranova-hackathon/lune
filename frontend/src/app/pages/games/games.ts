import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { GameCard } from '../../shared/game-card/game-card';
import { GameModel } from '../../core/models/game.model';
import { FormsModule } from '@angular/forms';
import { FilterState, toFilterParams } from '../../core/models/game-filter.model';
import { GameFilters } from '../../shared/game-filters/game-filters';
import { ScrollControls } from '../../shared/scroll-controls/scroll-controls';
import { GamesData } from './games-data';
import { GamesFavorites } from './games-favorites';
import { GamesQuery } from './games-query';

@Component({
  imports: [GameCard, FormsModule, GameFilters, ScrollControls],
  providers: [GamesData, GamesFavorites, GamesQuery],
  selector: 'app-games',
  styleUrl: './games.scss',
  templateUrl: './games.html',
})

export class Games implements OnInit {
  private readonly data = inject(GamesData);
  private readonly favorites = inject(GamesFavorites);
  private readonly filtersPanel = viewChild(GameFilters);
  private readonly loginDialog = viewChild<ElementRef<HTMLDialogElement>>('loginDialog');
  private readonly query = inject(GamesQuery);

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
    this.data.initialize(search => {
      if (this.searchInput.trim() !== search) {
        this.searchInput = search;
      }
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

  retryGames(): void {
    this.data.retry();
  }

  changePage(page: number): void {
    this.query.changePage(page);
  }

  submitSearch(): void {
    const draft = this.filtersPanel()?.filterState ?? this.filterState();
    this.query.submitSearch(this.searchInput, draft);
  }

  onSearchInput(value: string): void {
    this.query.onSearchInput(value);
  }

  submitFilters(state: FilterState): void {
    this.query.submitFilters(state);
  }

  resetFilters(): void {
    this.query.resetFilters();
  }
}
