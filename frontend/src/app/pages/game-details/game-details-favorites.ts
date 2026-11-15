import { DestroyRef, effect, inject, Service, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { FavoriteService } from '../../core/services/favorite-service';

@Service({ autoProvided: false })
export class GameDetailsFavorites {
  private readonly auth = inject(AuthService);
  private readonly favoriteService = inject(FavoriteService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private currentGameId: number | null = null;

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly favoriteIds = this.favoriteService.favoriteIds;
  readonly ready = signal(false);
  readonly busyIds = signal<Set<number>>(new Set());
  readonly error = signal('');

  constructor() {
    effect(onCleanup => {
      if (!this.isLoggedIn()) {
        this.ready.set(false);
        this.error.set('');
        this.favoriteService.clear();
        return;
      }

      this.ready.set(false);
      this.error.set('');

      const subscription = this.favoriteService.loadFavoriteIds().subscribe({
        next: () => {
          this.ready.set(true);
          this.completePendingFavorite();
        },
        error: () => {
          this.error.set('Could not load your favorite games.');
        }
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  reset(): void {
    this.currentGameId = null;
  }

  initialize(gameId: number): void {
    this.currentGameId = gameId;
    this.completePendingFavorite();
  }

  toggle(id: number): void {
    if (!this.isLoggedIn()) {
      this.favoriteService.setPendingFavorite(id);

      const returnUrl = this.router.serializeUrl(
        this.router.createUrlTree(['/games', id])
      );

      void this.router.navigate(['/login'], {
        queryParams: { returnUrl }
      });
      return;
    }

    if (!this.ready() || this.busyIds().has(id)) return;

    this.error.set('');
    this.busyIds.update(ids => new Set([...ids, id]));

    const request = this.favoriteIds().has(id)
      ? this.favoriteService.removeFavorite(id)
      : this.favoriteService.addFavorite(id);

    request.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.clearBusy(id),
      error: (err: HttpErrorResponse) => {
        this.clearBusy(id);

        if (this.currentGameId !== id) return;

        if (err.status === 409) {
          this.error.set('You have reached your Favorites limit.');
        } else if (err.status === 401) {
          this.error.set('Your session has expired. Please log in again.');
        } else {
          this.error.set('Could not update Favorites. Please try again.');
        }
      }
    });
  }

  private clearBusy(id: number): void {
    this.busyIds.update(ids => {
      const updated = new Set(ids);
      updated.delete(id);
      return updated;
    });
  }

  private completePendingFavorite(): void {
    if (!this.isLoggedIn() || !this.ready()) return;

    const gameId = this.currentGameId;
    if (gameId === null) return;

    const pendingId = this.favoriteService.takePendingFavorite();

    if (pendingId !== gameId || this.favoriteIds().has(pendingId)) return;

    this.toggle(pendingId);
  }
}