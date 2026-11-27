import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
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
  /** Solo ADMIN ve las acciones de escritura (el Gateway las rechaza con 403 para ESTUDIANTE). */
  protected readonly esAdmin = inject(AuthService).esAdmin;

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

  /** El DELETE no borra: deja la inscripción «cancelada» y libera el cupo del curso. */
  protected cancelar(inscripcion: InscripcionResumen): void {
    void this.deletion.run({
      key: inscripcion._id,
      confirm: {
        title: `¿Cancelar la inscripción al curso ${inscripcion.cursoId} (${inscripcion.periodo})?`,
        message: 'Quedará en estado «cancelada» y se liberará su cupo en el curso. Sus notas y su historial se conservan.',
        confirmLabel: 'Cancelar inscripción',
      },
      request: () => this.inscripciones.deleteInscripcion(inscripcion._id),
      successMessage: 'Se canceló la inscripción y se liberó el cupo.',
      onSuccess: () => this.list.reload(),
    });
  }
}
