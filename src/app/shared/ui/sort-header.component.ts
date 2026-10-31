import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SortDirection } from '../../models';

/** Cabecera de columna ordenable: `<th appSortHeader [direction]="..." (sort)="...">Nombre</th>`. */
@Component({
  selector: 'th[appSortHeader]',
  host: {
    scope: 'col',
    '[attr.aria-sort]': 'ariaSort()',
  },
  template: `
    <button type="button" class="sort" (click)="sort.emit()">
      <ng-content />
      <span class="sort__icon" aria-hidden="true">{{ icon() }}</span>
    </button>
  `,
  styles: `
    .sort {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 2rem;
      padding: 0;
      font: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    :host([aria-sort='ascending']) .sort,
    :host([aria-sort='descending']) .sort {
      color: var(--color-ink);
    }

    .sort__icon {
      width: 1ch;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortHeaderComponent {
  readonly direction = input<SortDirection | null>(null);
  readonly sort = output<void>();

  protected readonly ariaSort = computed(() => {
    const direction = this.direction();
    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
  });
  protected readonly icon = computed(() => {
    const direction = this.direction();
    return direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕';
  });
}
