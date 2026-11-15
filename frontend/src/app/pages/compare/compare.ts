import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { GameDetailsModel } from '../../core/models/game.model';
import { GamePriceComparison, PlatformPrice } from '../../core/models/game-price.model';
import { GameService } from '../../core/services/game-service';
import { GamePriceService } from '../../core/services/game-price-service';
import { CompareService, MAX_COMPARE } from '../../core/services/compare-service';
import { GamesNavigationService } from '../../core/services/games-navigation-service';

interface CompareEntry {
	game: GameDetailsModel;
	prices: GamePriceComparison | null;
	priceError: string | null;
	// cheapest store offer right now
	best: PlatformPrice | null;
}

// An entry plus how it stacks up against the others
interface CompareColumn extends CompareEntry {
	priceBest: boolean;
	priceDiff: number | null;
	ratingBest: boolean;
	ratingDiff: number | null;
	metaBest: boolean;
	metaDiff: number | null;
}

@Component({
	selector: 'app-compare',
	imports: [RouterLink, CurrencyPipe, DecimalPipe],
	templateUrl: './compare.html',
	styleUrl: './compare.scss',
	host: { '(document:keydown.escape)': 'goBack()' },
})
export class Compare {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly gameService = inject(GameService);
	private readonly priceService = inject(GamePriceService);
	private readonly compare = inject(CompareService);
	readonly gamesNavigation = inject(GamesNavigationService);

	// already-fetched games, so removing a column doesn't refetch the rest
	private readonly cache = new Map<number, CompareEntry>();

	readonly entries = signal<CompareEntry[]>([]);
	readonly loading = signal(false);
	readonly failedIds = signal<number[]>([]);

	// Prices can only be compared when every game is priced in the same currency
	readonly currency = computed(() => {
		const currencies = new Set(
			this.entries()
				.map(e => e.best?.currency?.toUpperCase())
				.filter((c): c is string => !!c)
		);
		return currencies.size === 1 ? [...currencies][0] : null;
	});

	readonly mixedCurrencies = computed(() =>
		this.currency() === null && this.entries().filter(e => e.best).length > 1
	);

	readonly columns = computed<CompareColumn[]>(() => {
		const entries = this.entries();
		const currency = this.currency();

		const prices = currency ? entries.map(e => e.best?.currentPrice ?? null) : [];
		const ratings = entries.map(e => (e.game.rating > 0 ? e.game.rating : null));
		const metas = entries.map(e => e.game.metacritic);

		const cheapest = winner(prices, 'min');
		const topRating = winner(ratings, 'max');
		const topMeta = winner(metas, 'max');

		return entries.map((entry, i) => ({
			...entry,
			priceBest: cheapest !== null && prices[i] === cheapest,
			priceDiff: diff(prices[i], cheapest),
			ratingBest: topRating !== null && ratings[i] === topRating,
			ratingDiff: diff(ratings[i], topRating),
			metaBest: topMeta !== null && metas[i] === topMeta,
			metaDiff: diff(metas[i], topMeta),
		}));
	});

	constructor() {
		this.route.queryParamMap.pipe(
			map(params => parseIds(params.get('ids'))),
			tap(ids => {
				// Opened without ids (e.g. from the navbar): use the current selection
				if (!ids.length && this.compare.count()) {
					this.syncUrl(this.compare.ids());
				}
			}),
			switchMap(ids => this.load(ids)),
			takeUntilDestroyed()
		).subscribe(entries => {
			this.entries.set(entries);
			this.loading.set(false);
		});
	}

	remove(id: number): void {
		this.compare.remove(id);
		this.syncUrl(this.entries().map(e => e.game.id).filter(x => x !== id));
	}

	goBack(): void {
		this.router.navigateByUrl(this.gamesNavigation.gamesUrl());
	}

	validStoreUrl(url: string | null): string | null {
		return url && /^https?:\/\//i.test(url) ? url : null;
	}

	retry(): void {
		const failed = this.failedIds();
		this.failedIds.set([]);
		this.load([...this.entries().map(e => e.game.id), ...failed])
			.subscribe(entries => {
				this.entries.set(entries);
				this.loading.set(false);
			});
	}

	private syncUrl(ids: number[]): void {
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { ids: ids.length ? ids.join(',') : null },
			replaceUrl: true,
		});
	}

	private load(ids: number[]): Observable<CompareEntry[]> {
		const missing = ids.filter(id => !this.cache.has(id));
		if (!missing.length) {
			return of(this.fromCache(ids));
		}

		this.loading.set(true);
		return forkJoin(missing.map(id => this.fetchEntry(id))).pipe(
			map(results => {
				const failed: number[] = [];
				results.forEach((entry, i) => {
					if (entry) this.cache.set(missing[i], entry);
					else failed.push(missing[i]);
				});
				this.failedIds.set(failed);
				return this.fromCache(ids);
			})
		);
	}

	private fromCache(ids: number[]): CompareEntry[] {
		return ids
			.map(id => this.cache.get(id))
			.filter((e): e is CompareEntry => !!e);
	}

	private fetchEntry(id: number): Observable<CompareEntry | null> {
		const prices$ = this.priceService.fetchPrices(id).pipe(
			map(prices => ({ prices, priceError: null as string | null })),
			catchError((err: HttpErrorResponse) => of({
				prices: null,
				priceError: err.status === 404
					? 'No pricing data'
					: 'Prices unavailable',
			}))
		);

		return forkJoin({
			game: this.gameService.fetchGameDetails(id, 1, 1),
			price: prices$,
		}).pipe(
			map(({ game, price }) => toEntry(game, price.prices, price.priceError)),
			catchError(() => of(null))
		);
	}
}

function toEntry(
	game: GameDetailsModel,
	prices: GamePriceComparison | null,
	priceError: string | null
): CompareEntry {
	const stores = prices?.platforms ?? [];
	const priced = stores.filter(s => s.currentPrice !== null);
	const best = priced.length
		? priced.reduce((a, b) => (b.currentPrice! < a.currentPrice! ? b : a))
		: null;

	return {
		game,
		prices,
		priceError: priceError ?? (prices && !priced.length ? 'No store prices' : null),
		best,
	};
}

function parseIds(raw: string | null): number[] {
	const ids = (raw ?? '')
		.split(',')
		.map(Number)
		.filter(id => Number.isInteger(id) && id > 0);
	return [...new Set(ids)].slice(0, MAX_COMPARE);
}

// The best value in a row, only when at least two games have one to compare
function winner(values: (number | null)[], mode: 'min' | 'max'): number | null {
	const present = values.filter((v): v is number => v !== null);
	if (present.length < 2) return null;
	return mode === 'min' ? Math.min(...present) : Math.max(...present);
}

function diff(value: number | null, best: number | null): number | null {
	if (value === null || best === null || value === best) return null;
	return value - best;
}
