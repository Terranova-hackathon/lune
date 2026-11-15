import { computed, Service, signal } from '@angular/core';
import { GameModel } from '../models/game.model';

export const MAX_COMPARE = 4;

// Holds the games picked for comparison so the selection survives
// moving between the games list and the compare page.
@Service()
export class CompareService {
	private readonly storageKey = 'compare-selection';

	readonly selected = signal<GameModel[]>(this.restore());
	readonly ids = computed(() => this.selected().map(game => game.id));
	readonly count = computed(() => this.selected().length);
	readonly isFull = computed(() => this.count() >= MAX_COMPARE);

	has(id: number): boolean {
		return this.selected().some(game => game.id === id);
	}

	toggle(game: GameModel): void {
		if (this.has(game.id)) {
			this.remove(game.id);
		} else if (!this.isFull()) {
			this.update([...this.selected(), game]);
		}
	}

	remove(id: number): void {
		this.update(this.selected().filter(game => game.id !== id));
	}

	clear(): void {
		this.update([]);
	}

	private update(games: GameModel[]): void {
		this.selected.set(games);
		try {
			sessionStorage.setItem(this.storageKey, JSON.stringify(games));
		} catch {
			// storage unavailable (private mode etc.): keep in memory only
		}
	}

	private restore(): GameModel[] {
		try {
			const saved = JSON.parse(sessionStorage.getItem(this.storageKey) ?? '[]');
			return Array.isArray(saved) ? saved.slice(0, MAX_COMPARE) : [];
		} catch {
			return [];
		}
	}
}
