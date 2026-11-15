import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-games-pagination',
  templateUrl: './games-pagination.html',
  styleUrl: './games-pagination.scss',
})
export class GamesPagination {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalGames = input.required<number>();
  readonly loading = input(false);
  readonly filtered = input(false);

  readonly pageChanged = output<number>();

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

  changePage(page: number): void {
    this.pageChanged.emit(page);
  }
}
