import { Component, input } from '@angular/core';
import { GameDetailsModel } from '../../../../core/models/game.model';

@Component({
  imports: [],
  selector: 'app-game-description',
  styleUrl: './game-description.scss',
  templateUrl: './game-description.html',
})
export class GameDescription {
  readonly game = input.required<GameDetailsModel>();
}
