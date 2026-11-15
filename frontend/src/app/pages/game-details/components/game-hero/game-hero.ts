import { Component, input } from '@angular/core';
import { GameDetailsModel } from '../../../../core/models/game.model';

@Component({
  imports: [],
  selector: 'app-game-hero',
  styleUrl: './game-hero.scss',
  templateUrl: './game-hero.html',
})
export class GameHero {
  readonly game = input.required<GameDetailsModel>();
}
