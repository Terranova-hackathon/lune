import { Component, ElementRef, output, viewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-games-login-prompt',
  styleUrl: './games-login-prompt.scss',
  templateUrl: './games-login-prompt.html',
})
export class GamesLoginPrompt {
  private readonly dialog =
    viewChild<ElementRef<HTMLDialogElement>>('dialog');

  private gameId: number | null = null;

  readonly confirmed = output<number>();

  open(gameId: number): void {
    this.gameId = gameId;
    this.dialog()?.nativeElement.showModal();
  }

  confirm(): void {
    if (this.gameId === null) return;

    this.confirmed.emit(this.gameId);
  }
}
