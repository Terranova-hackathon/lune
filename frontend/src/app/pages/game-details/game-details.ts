import { Component, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameService } from '../../core/services/game-service';
import { catchError, combineLatest, EMPTY, map, startWith, Subject, switchMap, tap } from 'rxjs';
import { GamesNavigationService } from '../../core/services/games-navigation-service';
import { GameDetailsModel } from '../../core/models/game.model';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';
import { FavoriteService } from '../../core/services/favorite-service';
import { PriceComparison } from '../../shared/price-comparison/price-comparison';
import { ScrollControls } from '../../shared/scroll-controls/scroll-controls';
import { GameDetailsRelated } from './game-details-related';
import { GameDetailsFavorites } from './game-details-favorites';
import { GameFacts } from './components/game-facts/game-facts';
import { GameGallery } from './components/game-gallery/game-gallery';
import { GameRatings } from './components/game-ratings/game-ratings';

@Component({
  imports: [RouterLink, DecimalPipe, ScrollControls,GameFacts, GameGallery, GameRatings],
  providers: [GameDetailsRelated, GameDetailsFavorites],
  selector: 'app-game-details',
  styleUrl: './game-details.scss',
  templateUrl: './game-details.html',
  host: { '(document:keydown.escape)': 'goBack()' },
})
export class GameDetails implements OnInit {
  private readonly gameService = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retryRequest = new Subject<void>();
  private readonly related = inject(GameDetailsRelated);
  private readonly favorites = inject(GameDetailsFavorites);

  readonly gamesNavigation = inject(GamesNavigationService);
  private pressStartedOnBackdrop = false;
  readonly relatedGames = this.related.games;
  readonly relatedLoading = this.related.loading;
  readonly relatedError = this.related.error;
  readonly isLoggedIn = this.favorites.isLoggedIn;
  readonly favoriteIds = this.favorites.favoriteIds;
  readonly favoritesReady = this.favorites.ready;
  readonly favoriteBusyIds = this.favorites.busyIds;
  readonly favoriteError = this.favorites.error;

  game = signal<GameDetailsModel | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id$ = this.route.paramMap.pipe(
      map(params => Number(params.get('id')))
    );

    combineLatest([
      id$,
      this.retryRequest.pipe(startWith(undefined))
    ]).pipe(
      map(([id]) => id),
      tap(() => {
        this.loading.set(true);
        this.error.set('');
        this.game.set(null);
        this.related.reset();
        this.favorites.reset();
      }),
      switchMap(id =>
        this.gameService.fetchGameDetails(id).pipe(
          catchError((err: HttpErrorResponse) => {
            this.loading.set(false);
            this.game.set(null);
            this.error.set(
              err.status === 404
                ? 'Game not found.'
                : 'Unable to load this game. Please try again.'
            );
            return EMPTY;
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(game => {
      this.game.set(game);
      this.related.initialize(game);
      this.loading.set(false);
      this.favorites.initialize(game.id);
    });
  }
  retry(): void {
    this.retryRequest.next();
  }

  onBackdropPointerDown(event: PointerEvent): void {
  this.pressStartedOnBackdrop = this.isBackdrop(event);
}

  onBackdropClick(event: MouseEvent): void {
    if (this.pressStartedOnBackdrop && this.isBackdrop(event)) {
      this.goBack();
    }
    this.pressStartedOnBackdrop = false;
  }

  goBack(): void {
    this.router.navigateByUrl(this.gamesNavigation.gamesUrl());
  }

  private isBackdrop(event: Event): boolean {
    const target = event.target as HTMLElement;
    return target === event.currentTarget
      || target.classList.contains('game-details__container');
  }

  changeRelatedPage(page: number): void {
    this.related.changePage(page);
  }
  toggleFavorite(id: number): void {
    this.favorites.toggle(id);
  }
}
