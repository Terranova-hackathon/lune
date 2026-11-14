import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GameDetailsModel } from '../../../../core/models/game.model';
import { PriceComparison } from '../../../../shared/price-comparison/price-comparison';

@Component({
  imports: [DecimalPipe, PriceComparison],
  selector: 'app-game-ratings',
  styleUrl: './game-ratings.scss',
  templateUrl: './game-ratings.html',
})
export class GameRatings {
  readonly game = input.required<GameDetailsModel>();

  metacriticClass(score: number): string {
    return score >= 75 ? 'good' : score >= 50 ? 'mixed' : 'bad';
  }
}
