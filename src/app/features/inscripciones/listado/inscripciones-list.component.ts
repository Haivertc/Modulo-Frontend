import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { deleteAction } from '../../../core/feedback/delete-action';
import { syncFilterForm } from '../../../core/list/filter-form-sync';
import { urlPaginatedList } from '../../../core/list/url-paginated-list';
import { InscripcionesService } from '../../../core/services/inscripciones.service';
import { InscripcionResumen } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SortHeaderComponent } from '../../../shared/ui/sort-header.component';

@Component({
  selector: 'app-inscripciones-list',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    LoadingStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SortHeaderComponent,
  ],
  templateUrl: './inscripciones-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InscripcionesListComponent {
  private readonly inscripciones = inject(InscripcionesService);

  protected readonly list = urlPaginatedList<InscripcionResumen>({
    sortFields: ['periodo', 'estado', 'estudianteId', 'cursoId'],
    filterKeys: ['periodo', 'estudianteId', 'cursoId'],
    load: (q) =>
      this.inscripciones.getInscripciones(q.pageNumber, q.pageSize, q.sortBy, q.sortBy ? q.sortDirection : undefined, q.filtros),
    notFoundMessage: 'El Gateway no encontró el listado de inscripciones.',
  });

  protected readonly filtros = new FormGroup({
    periodo: new FormControl('', { nonNullable: true }),
    estudianteId: new FormControl('', { nonNullable: true }),
    cursoId: new FormControl('', { nonNullable: true }),
  });
  protected readonly hayFiltros = computed(() => Object.keys(this.list.query().filtros).length > 0);

  protected readonly deletion = deleteAction();

  constructor() {
    syncFilterForm(this.filtros, this.list);
  }

  protected eliminar(inscripcion: InscripcionResumen): void {
    void this.deletion.run({
      key: inscripcion._id,
      confirm: {
        title: `¿Eliminar la inscripción al curso ${inscripcion.cursoId} (${inscripcion.periodo})?`,
        message: 'También se eliminarán sus notas y su historial de estados. Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar inscripción',
      },
      request: () => this.inscripciones.deleteInscripcion(inscripcion._id),
      successMessage: 'Se eliminó la inscripción.',
      onSuccess: () => this.list.reload(),
    });
  }
}
