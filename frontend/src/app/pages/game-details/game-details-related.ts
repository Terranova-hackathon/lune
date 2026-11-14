import { DestroyRef, inject, Injectable, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, Subject, switchMap } from 'rxjs';
import { GameService } from '../../core/services/game-service';
import { GameDetailsModel, GameModel } from '../../core/models/game.model';
import { PagedResult } from '../../core/models/paged-result.model';

@Service({ autoProvided: false })
export class GameDetailsRelated {
  private readonly gameService = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageRequests = new Subject<number>();
  private currentGameId: number | null = null;

  readonly pageSize = 6;
  readonly games = signal<PagedResult<GameModel> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.pageRequests.pipe(
      switchMap(page => {
        const gameId = this.currentGameId;

        if (gameId === null) return EMPTY;

        this.loading.set(true);
        this.error.set('');

        return this.gameService.fetchGameDetails(
          gameId, page, this.pageSize
        ).pipe(
          map(response => ({
            gameId,
            related: response.relatedGames
          })),
          catchError(() => {
            if (this.currentGameId === gameId) {
              this.loading.set(false);
              this.error.set(
                'Could not load related games. Please try again.'
              );
            }

            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ gameId, related }) => {
      if (this.currentGameId !== gameId) return;

      this.games.set(related);
      this.loading.set(false);
    });
  }

  reset(): void {
    this.currentGameId = null;
    this.games.set(null);
    this.loading.set(false);
    this.error.set('');
  }

  initialize(game: GameDetailsModel): void {
    this.currentGameId = game.id;
    this.games.set(game.relatedGames);
  }

  changePage(page: number): void {
    const related = this.games();

    if (this.currentGameId === null || !related || this.loading()) {
      return;
    }

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > related.totalPages ||
      page === related.page
    ) {
      return;
    }

    this.pageRequests.next(page);
  }
}
