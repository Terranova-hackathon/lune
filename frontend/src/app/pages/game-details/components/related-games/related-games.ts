import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GameModel } from '../../../../core/models/game.model';
import { PagedResult } from '../../../../core/models/paged-result.model';

@Component({
  imports: [RouterLink, DecimalPipe],
  selector: 'app-related-games',
  styleUrls: [
    './related-games.scss',
    './related-games-pagination.scss'
  ],
  templateUrl: './related-games.html',
})
export class RelatedGames {
  readonly relatedGames =
    input.required<PagedResult<GameModel> | null>();

  readonly relatedLoading = input(false);
  readonly relatedError = input('');

  readonly pageChanged = output<number>();

  changeRelatedPage(page: number): void {
    this.pageChanged.emit(page);
  }
}
