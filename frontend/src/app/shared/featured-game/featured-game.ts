import { afterRenderEffect, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDetailsModel } from '../../core/models/game.model';
import { Subscription, timer } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
  private autoplayTimer?: Subscription;
  private isHovered = false;
  private isFocused = false;
  readonly autoplayPaused = signal(false);

  activeIndex = signal(0);

  constructor() {
    afterRenderEffect(() => {
      this.games();
      this.updateScrollState();
      this.scheduleAutoplay();
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
    this.autoplayPaused.set(this.isHovered);
    this.scheduleAutoplay();
  }

  private scheduleAutoplay(): void {
    this.autoplayTimer?.unsubscribe();

    if (this.games().length <= 1) return;

    const delay = this.isFocused ? 20_000 : 10_000;

    this.autoplayTimer = timer(delay)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const count = this.games().length;
        if (count > 1) {
          this.scrollToIndex((this.activeIndex() + 1) % count);
        }

        this.scheduleAutoplay();
      });
  }

  onCarouselKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const direction =
      event.key === 'ArrowRight' ? 1 :
      event.key === 'ArrowLeft' ? -1 :
      0;

    if (!direction) return;

    const count = this.games().length;
    if (count <= 1) return;

    event.preventDefault();
    this.scrollToIndex((this.activeIndex() + direction + count) % count);
  }
}
