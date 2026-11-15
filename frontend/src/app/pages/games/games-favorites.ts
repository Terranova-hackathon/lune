import { DestroyRef, effect, inject, Service, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { FavoriteService } from '../../core/services/favorite-service';

@Service({ autoProvided: false })
export class GamesFavorites {
  private readonly auth = inject(AuthService);
  private readonly favoriteService = inject(FavoriteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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

  toggle(id: number): void {
    if (!this.isLoggedIn() || !this.ready() || this.busyIds().has(id)) {
      return;
    }

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

        if (err.status === 409) {
          this.error.set('You have reached Favorites limit.');
        } else if (err.status === 401) {
          this.error.set('Session expired or no logged in.');
        } else {
          this.error.set('Could not update favorites. Try again.');
        }
      }
    });
  }

  goToLogin(id: number): void {
    this.favoriteService.setPendingFavorite(id);

    const returnUrl = this.router.serializeUrl(
      this.router.createUrlTree(['/games'], {
        queryParams: this.route.snapshot.queryParams,
        fragment: `game-${id}`
      })
    );

    void this.router.navigate(['/login'], {
      queryParams: { returnUrl }
    });
  }

  private completePendingFavorite(): void {
    const id = this.favoriteService.takePendingFavorite();

    if (id === null) return;
    if (this.route.snapshot.fragment !== `game-${id}`) return;
    if (this.favoriteIds().has(id)) return;

    this.toggle(id);
  }

  private clearBusy(id: number): void {
    this.busyIds.update(ids => {
      const updated = new Set(ids);
      updated.delete(id);
      return updated;
    });
  }
}
