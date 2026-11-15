import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDetailsModel } from '../../../../core/models/game.model';

@Component({
  selector: 'app-game-facts',
  imports: [RouterLink],
  templateUrl: './game-facts.html',
  styleUrl: './game-facts.scss',
})
export class GameFacts {
  readonly game = input.required<GameDetailsModel>();
}