import { Component, input, output } from '@angular/core';
import { GameDetailsModel } from '../../../../core/models/game.model';

@Component({
  imports: [],
  selector: 'app-game-heading',
  styleUrl: './game-heading.scss',
  templateUrl: './game-heading.html',
})
export class GameHeading {
  readonly game = input.required<GameDetailsModel>();
  readonly isFavorite = input(false);
  readonly favoriteBusy = input(false);
  readonly favoriteError = input('');

  readonly favoriteToggled = output<number>();
}
