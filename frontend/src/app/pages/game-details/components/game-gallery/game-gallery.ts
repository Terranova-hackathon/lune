import { Component, input, signal } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-game-gallery',
  styleUrl: './game-gallery.scss',
  templateUrl: './game-gallery.html',
})
export class GameGallery {
  readonly screenshots = input.required<string[]>();
  readonly gameName = input.required<string>();
  readonly selectedShot = signal<string | null>(null);
}
