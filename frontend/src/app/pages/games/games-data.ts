import { afterNextRender, DestroyRef, inject, Injector, Service, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, distinctUntilChanged, EMPTY, map, startWith, Subject, switchMap, tap } from 'rxjs';
import { GameModel } from '../../core/models/game.model';
import { emptyFilterState, FilterState, toFilterState } from '../../core/models/game-filter.model';
import { GameService } from '../../core/services/game-service';
import { GamesNavigationService } from '../../core/services/games-navigation-service';
import { readGameQuery } from '../../core/utils/game-query';

@Service({ autoProvided: false })
export class GamesData {
  private readonly gameService = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly gamesNavigation = inject(GamesNavigationService);
  private readonly retryRequest = new Subject<void>();

  readonly pageSize = 12;
  readonly games = signal<GameModel[]>([]);
  readonly currentPage = signal(1);
  readonly totalPages = signal(0);
  readonly totalGames = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searchTerm = signal('');
  readonly filterState = signal<FilterState>(emptyFilterState(), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  initialize(syncSearchInput: (search: string) => void): void {
    const params$ = this.route.queryParamMap.pipe(
      map(params => readGameQuery(params)),

      distinctUntilChanged((previous, current) =>
        JSON.stringify(previous) === JSON.stringify(current)
      )
    );

    combineLatest([params$,
      this.retryRequest.pipe(startWith(undefined))
    ]).pipe(
      map(([params]) => params),
      tap(query => {
        syncSearchInput(query.search ?? '');
        this.searchTerm.set(query.search ?? '');
        this.currentPage.set(query.page ?? 1);
        this.gamesNavigation.memorize(
          this.router.url.split('#')[0]
        );
        this.loading.set(true);
        this.error.set('');
        this.filterState.set(toFilterState(query));
      }),

      switchMap(query =>
        this.gameService.fetchGames({...query,
          pageSize: this.pageSize
        }).pipe(
          catchError((err: HttpErrorResponse) => {
            this.loading.set(false);
            this.games.set([]);
            this.totalPages.set(0);
            this.totalGames.set(0);
            this.error.set(
              err.status === 401
               ? 'Request failed. Please try again.'
               : 'Unable to load games. Please try again.'
            );
            return EMPTY;
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.games.set(response.items);
      this.currentPage.set(response.page);
      this.totalPages.set(response.totalPages);
      this.totalGames.set(response.totalCount);
      this.loading.set(false);
      const fragment = this.route.snapshot.fragment;

      if (fragment && /^game-\d+$/.test(fragment)) {
        afterNextRender({
          mixedReadWrite: () => {
            document.getElementById(fragment)
              ?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
          }
        }, { injector: this.injector });
      }
    });
  }


  retry(): void {
    this.retryRequest.next();
  }
}
