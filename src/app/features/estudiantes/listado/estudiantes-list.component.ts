import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { syncFilterForm } from '../../../core/list/filter-form-sync';
import { urlPaginatedList } from '../../../core/list/url-paginated-list';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { Estudiante, Programa } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SortHeaderComponent } from '../../../shared/ui/sort-header.component';

@Component({
  selector: 'app-estudiantes-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LoadingStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SortHeaderComponent,
  ],
  templateUrl: './estudiantes-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstudiantesListComponent {
  private readonly estudiantes = inject(EstudiantesService);

  protected readonly list = urlPaginatedList<Estudiante>({
    sortFields: ['nombre', 'apellido', 'correo', 'contacto.ciudad'],
    filterKeys: ['search', 'programa', 'ciudad'],
    load: (q) => this.estudiantes.getEstudiantes(q.pageNumber, q.pageSize, q.sortBy, q.sortBy ? q.sortDirection : undefined, q.filtros),
    notFoundMessage: 'El Gateway no encontró el listado de estudiantes.',
  });

  protected readonly filtros = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    programa: new FormControl('', { nonNullable: true }),
    ciudad: new FormControl('', { nonNullable: true }),
  });
  protected readonly hayFiltros = computed(() => Object.keys(this.list.query().filtros).length > 0);

  /** Opciones del filtro de programa; si no cargan, el filtro queda solo con "Todos". */
  protected readonly programas = toSignal(
    this.estudiantes.getProgramas().pipe(catchError(() => of<Programa[]>([]))),
    { initialValue: [] as Programa[] },
  );

  /**
   * Estudiantes cuya foto no cargó (p. ej. la URL firmada de S3 venció tras 1 hora en la
   * misma página): se muestran sus iniciales. Al recargar el listado llegan URLs nuevas.
   */
  protected readonly fotosFallidas = signal<ReadonlySet<string>>(new Set());

  constructor() {
    syncFilterForm(this.filtros, this.list);
  }

  protected marcarFotoFallida(id: string): void {
    this.fotosFallidas.update((ids) => new Set(ids).add(id));
  }

  protected iniciales(e: Estudiante): string {
    return `${e.nombre.charAt(0)}${e.apellido.charAt(0)}`.toUpperCase();
  }
}
