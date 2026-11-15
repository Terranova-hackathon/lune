import { afterRenderEffect, Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDetailsModel } from '../../core/models/game.model';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  imports: [RouterLink],
  selector: 'app-featured-game',
  styleUrl: './featured-game.scss',
  templateUrl: './featured-game.html',
})
export class FeaturedGame {
  games = input.required<GameDetailsModel[]>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private isHovered = false;
  private isFocused = false;
  readonly autoplayPaused = signal(false);

  activeIndex = signal(0);

  constructor() {
    afterRenderEffect(() => {
      this.games();
      this.updateScrollState();
    });

    interval(15_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const count = this.games().length;
        if (count <= 1 || this.autoplayPaused()) return;

        this.scrollToIndex((this.activeIndex() + 1) % count);
    });
  }

  scrollToIndex(index: number): void {
    const el = this.track()?.nativeElement;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  updateScrollState(): void {
    const el = this.track()?.nativeElement;
    if (!el || el.clientWidth === 0) return;

    this.activeIndex.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  releaseYear(released: string | null): string {
    return released?.slice(0, 4) ?? '';
  }
  pauseOnHover(): void {
    this.isHovered = true;
    this.updateAutoplayPause();
  }

  resumeAfterHover(): void {
    this.isHovered = false;
    this.updateAutoplayPause();
  }

  pauseOnFocus(): void {
    this.isFocused = true;
    this.updateAutoplayPause();
  }

  resumeAfterFocus(event: FocusEvent): void {
    const container = event.currentTarget;
    const nextTarget = event.relatedTarget;

    if (
      container instanceof HTMLElement &&
      nextTarget instanceof Node &&
      container.contains(nextTarget)
    ) {
      return;
    }

    this.isFocused = false;
    this.updateAutoplayPause();
  }

  private updateAutoplayPause(): void {
    this.autoplayPaused.set(this.isHovered || this.isFocused);
  }

  private lastWheelNavigationAt = 0;

  onWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const nextIndex = this.activeIndex() + Math.sign(event.deltaY);
    if (nextIndex < 0 || nextIndex >= this.games().length) return;

    event.preventDefault();

    const now = Date.now();
    if (now - this.lastWheelNavigationAt < 700) return;

    this.lastWheelNavigationAt = now;
    this.scrollToIndex(nextIndex);
  }
}
