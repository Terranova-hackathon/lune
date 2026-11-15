import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CompareService, MAX_COMPARE } from '../../core/services/compare-service';

@Component({
  imports: [],
  selector: 'app-compare-tray',
  styleUrl: './compare-tray.scss',
  templateUrl: './compare-tray.html',
})
export class CompareTray {
  private readonly router = inject(Router);
  readonly compare = inject(CompareService);
  readonly maxCompare = MAX_COMPARE;

  open(): void {
    if (this.compare.count() < 2) return;
    this.router.navigate(['/compare'], {
      queryParams: { ids: this.compare.ids().join(',') }
    });
  }
}
