import { Component, computed, inject, OnInit, viewChild } from '@angular/core';
import { GameCard } from '../../shared/game-card/game-card';
import { GameModel } from '../../core/models/game.model';
import { FormsModule } from '@angular/forms';
import { FilterState, toFilterParams } from '../../core/models/game-filter.model';
import { GameFilters } from '../../shared/game-filters/game-filters';
import { ScrollControls } from '../../shared/scroll-controls/scroll-controls';
import { GamesData } from './games-data';
import { GamesFavorites } from './games-favorites';
import { GamesQuery } from './games-query';
import { GamesPagination } from './components/games-pagination/games-pagination';
import { GamesLoginPrompt } from './components/games-login-prompt/games-login-prompt';
import { CompareService, MAX_COMPARE } from '../../core/services/compare-service';
import { Router } from '@angular/router';

@Component({
  imports: [GameCard, FormsModule, GameFilters, GamesLoginPrompt, GamesPagination, ScrollControls],
  providers: [GamesData, GamesFavorites, GamesQuery],
  selector: 'app-games',
  styleUrl: './games.scss',
  templateUrl: './games.html',
})

export class Games implements OnInit {
  private readonly data = inject(GamesData);
  private readonly favorites = inject(GamesFavorites);
  private readonly filtersPanel = viewChild(GameFilters);
  private readonly loginDialog = viewChild(GamesLoginPrompt);
  private readonly query = inject(GamesQuery);
  private readonly compare = inject(CompareService);
  private readonly router = inject(Router);

  readonly selectedGames = this.compare.selected;
  readonly compareFull = this.compare.isFull;
  readonly maxCompare = MAX_COMPARE;

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

  toggleFavorite(id: number): void {
    if (!this.isLoggedIn()) {
      this.openLoginPrompt(id);
      return;
    }

    this.favorites.toggle(id);
  }

  private openLoginPrompt(id: number): void {
    this.loginDialog()?.open(id);
  }

  goToLogin(id: number): void {
    this.favorites.goToLogin(id);
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

  isGameSelected(gameId: number): boolean {
    return this.compare.has(gameId);
  }

  toggleCompare(game: GameModel): void {
    this.compare.toggle(game);
  }

  removeFromComparison(id: number): void {
    this.compare.remove(id);
  }

  clearComparison(): void {
    this.compare.clear();
  }

  openComparison(): void {
    if (this.selectedGames().length < 2) return;
    this.router.navigate(['/compare'], {
      queryParams: { ids: this.compare.ids().join(',') }
    });
  }
}
