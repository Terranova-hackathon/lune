import { DestroyRef, inject, Service } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { debounceTime, map, Subject } from 'rxjs';
import {
  FilterState, toFilterParams
} from '../../core/models/game-filter.model';
import { GamesData } from './games-data';

@Service({ autoProvided: false })
export class GamesQuery {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);
	private readonly data = inject(GamesData);
	private readonly searchTyped = new Subject<string>();

	constructor() {
		this.searchTyped.pipe(
		map(value => value.trim()),
		debounceTime(300),
		takeUntilDestroyed(this.destroyRef)
		).subscribe(search => {
		if (search === this.data.searchTerm()) return;

		void this.router.navigate(['/games'], {
			queryParams: this.searchParams(search),
			queryParamsHandling: 'merge'
		});
		});
	}

	onSearchInput(value: string): void {
		this.searchTyped.next(value);
	}

	submitSearch(value: string, draft: FilterState): void {
		void this.router.navigate(['/games'], {
		queryParams: {
			...this.searchParams(value.trim()),
			...toFilterParams(draft)
		},
		queryParamsHandling: 'merge'
		});
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
		queryParams: { search: this.data.searchTerm() || null }
		});
	}

	changePage(page: number): void {
		if (page < 1 || page > this.data.totalPages()) return;
		if (page === this.data.currentPage()) return;

		void this.router.navigate(['/games'], {
		queryParams: { page: page === 1 ? null : page },
		queryParamsHandling: 'merge'
		});
	}

	private searchParams(search: string) {
		const wasSearching = this.data.searchTerm() !== '';

		if (search && !wasSearching) {
		const page = this.data.currentPage();
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
}

function readFromPage(params: ParamMap): number | null {
	const page = Number(params.get('fromPage'));
	return Number.isSafeInteger(page) && page > 1 ? page : null;
}
