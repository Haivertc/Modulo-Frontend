import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { deleteAction } from '../../../core/feedback/delete-action';
import { NotificationService } from '../../../core/feedback/notification.service';
import { FileDownloadService } from '../../../core/files/file-download.service';
import { describeGatewayError } from '../../../core/http/gateway-error';
import { syncFilterForm } from '../../../core/list/filter-form-sync';
import { urlPaginatedList } from '../../../core/list/url-paginated-list';
import { MateriasService } from '../../../core/services/materias.service';
import { Materia } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SortHeaderComponent } from '../../../shared/ui/sort-header.component';

const ENTERO_POSITIVO = /^[1-9]\d*$/;

@Component({
  selector: 'app-materias-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LoadingStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SortHeaderComponent,
  ],
  templateUrl: './materias-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriasListComponent {
  private readonly materias = inject(MateriasService);

  protected readonly list = urlPaginatedList<Materia>({
    sortFields: ['nombre', 'creditos', 'programa'],
    filterKeys: ['nombre', 'creditos', 'programa'],
    load: (q) => {
      const { nombre, creditos, programa } = q.filtros;
      return this.materias.getMaterias(q.pageNumber, q.pageSize, q.sortBy, q.sortBy ? q.sortDirection : undefined, {
        nombre,
        // Un valor no numérico en la URL se ignora: el módulo respondería 400 al convertirlo.
        creditos: creditos && ENTERO_POSITIVO.test(creditos) ? Number(creditos) : undefined,
        programa,
      });
    },
    notFoundMessage: 'El Gateway no encontró el catálogo de materias.',
  });

  protected readonly filtros = new FormGroup({
    nombre: new FormControl('', { nonNullable: true }),
    creditos: new FormControl('', { nonNullable: true, validators: Validators.pattern(ENTERO_POSITIVO) }),
    programa: new FormControl('', { nonNullable: true }),
  });
  protected readonly hayFiltros = computed(() => Object.keys(this.list.query().filtros).length > 0);

  protected readonly deletion = deleteAction();

  private readonly notifications = inject(NotificationService);
  private readonly files = inject(FileDownloadService);
  /** Materia cuyo PDF se está pidiendo (evita dobles clics). */
  protected readonly descargando = signal<number | null>(null);

  constructor() {
    syncFilterForm(this.filtros, this.list);
  }

  /**
   * Pide el contenido temático al hacer clic (no al cargar el listado) para que la URL
   * firmada de S3 esté vigente; si hay varios PDFs, descarga el más reciente.
   */
  protected descargarContenido(materia: Materia): void {
    this.descargando.set(materia.id);
    this.materias
      .getContenidoTematico(materia.id)
      .pipe(finalize(() => this.descargando.set(null)))
      .subscribe({
        next: (archivos) => {
          const ultimo = archivos.at(-1);
          if (!ultimo) {
            this.notifications.error(
              `${materia.nombre} no tiene contenido temático`,
              'Todavía no se ha subido ningún PDF para esta materia.',
            );
            return;
          }
          this.files.download(ultimo.url);
        },
        error: (err: unknown) => {
          const vista = describeGatewayError(err, 'La materia ya no existe. Recarga el listado.');
          this.notifications.error(vista.title, vista.message);
        },
      });
  }

  protected eliminar(materia: Materia): void {
    void this.deletion.run({
      key: String(materia.id),
      confirm: {
        title: `¿Eliminar la materia ${materia.nombre}?`,
        message: 'Se eliminará del catálogo. Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar materia',
      },
      request: () => this.materias.deleteMateria(materia.id),
      successMessage: `Se eliminó la materia ${materia.nombre}.`,
      onSuccess: () => this.list.reload(),
    });
  }
}
