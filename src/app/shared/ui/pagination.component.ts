import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PAGE_SIZES } from '../../core/list/url-paginated-list';
import { PaginatedResponse } from '../../models';

@Component({
  selector: 'app-pagination',
  template: `
    <nav class="pagination" [attr.aria-label]="label()">
      @if (rango(); as r) {
        <p class="pagination__range">Mostrando {{ r.desde }}–{{ r.hasta }} de {{ r.total }}</p>
      }

      <label class="pagination__size">
        Por página
        <select (change)="pageSizeChange.emit(+$any($event.target).value)">
          @for (size of pageSizes; track size) {
            <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
          }
        </select>
      </label>

      <div class="pagination__pages">
        <button
          type="button"
          class="button button--secondary"
          [disabled]="page().pageNumber <= 1 || busy()"
          (click)="pageChange.emit(page().pageNumber - 1)"
        >Anterior</button>
        <span>Página {{ page().pageNumber }} de {{ page().totalPages }}</span>
        <button
          type="button"
          class="button button--secondary"
          [disabled]="page().pageNumber >= page().totalPages || busy()"
          (click)="pageChange.emit(page().pageNumber + 1)"
        >Siguiente</button>
      </div>
    </nav>
  `,
  styles: `
    .pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4) var(--space-8);
      margin-top: var(--space-4);
    }

    .pagination__range {
      margin: 0;
      color: var(--color-ink-muted);
    }

    .pagination__size select {
      min-height: 2.75rem;
      margin-left: var(--space-2);
      padding: 0 var(--space-2);
      font: inherit;
    }

    .pagination__pages {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    @media (min-width: 48rem) {
      .pagination__pages {
        margin-left: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input.required<PaginatedResponse<unknown>>();
  readonly pageSize = input.required<number>();
  readonly busy = input(false);
  readonly label = input('Paginación');
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly rango = computed(() => {
    const page = this.page();
    if (page.items.length === 0) return null;
    const desde = (page.pageNumber - 1) * page.pageSize + 1;
    return { desde, hasta: desde + page.items.length - 1, total: page.totalElements };
  });
}
