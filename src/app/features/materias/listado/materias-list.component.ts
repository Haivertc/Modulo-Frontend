import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, filter, finalize, map, merge, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { deleteAction } from '../../../core/feedback/delete-action';
import { NotificationService } from '../../../core/feedback/notification.service';
import { FileDownloadService } from '../../../core/files/file-download.service';
import { FORMATOS_PDF, MAX_BYTES_PDF } from '../../../core/files/formatos';
import { describeGatewayError } from '../../../core/http/gateway-error';
import { syncFilterForm } from '../../../core/list/filter-form-sync';
import { urlPaginatedList } from '../../../core/list/url-paginated-list';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { MateriasService } from '../../../core/services/materias.service';
import { Materia, Programa } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { FileUploadDialogComponent } from '../../../shared/ui/file-upload-dialog.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SortHeaderComponent } from '../../../shared/ui/sort-header.component';

const ENTERO_POSITIVO = /^[1-9]\d*$/;

/** Estado del contenido temático de una materia en la fila del listado. */
type EstadoContenido = 'consultando' | 'con' | 'sin' | 'error';

@Component({
  selector: 'app-materias-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LoadingStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SortHeaderComponent,
    FileUploadDialogComponent,
  ],
  templateUrl: './materias-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriasListComponent {
  private readonly materias = inject(MateriasService);
  private readonly notifications = inject(NotificationService);
  private readonly files = inject(FileDownloadService);

  protected readonly esAdmin = inject(AuthService).esAdmin;

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

  /** Programas del módulo Estudiantes; si no cargan, el filtro queda solo con "Todos". */
  private readonly programas = toSignal(
    inject(EstudiantesService)
      .getProgramas()
      .pipe(catchError(() => of<Programa[]>([]))),
    { initialValue: [] as Programa[] },
  );
  /** Incluye el programa de la URL aunque no esté en el catálogo, para no ocultar el filtro activo. */
  protected readonly opcionesPrograma = computed(() => {
    const nombres = this.programas().map((p) => p.nombre);
    const actual = this.list.query().filtros['programa'];
    return actual && !nombres.includes(actual) ? [actual, ...nombres] : nombres;
  });

  protected readonly deletion = deleteAction();

  // ---------- Contenido temático (PDF en S3) ----------

  private readonly estados = signal<ReadonlyMap<number, EstadoContenido>>(new Map());
  /** Materia cuyo PDF se está pidiendo para descargar (evita dobles clics). */
  protected readonly descargando = signal<number | null>(null);

  private readonly dialogoSubida = viewChild(FileUploadDialogComponent);
  private readonly materiaSubida = signal<{ materia: Materia; reemplazo: boolean } | null>(null);
  protected readonly tituloSubida = computed(() => {
    const actual = this.materiaSubida();
    if (!actual) return 'Subir contenido temático';
    return `${actual.reemplazo ? 'Reemplazar' : 'Subir'} contenido temático: ${actual.materia.nombre}`;
  });
  protected readonly formatosPdf = FORMATOS_PDF;
  protected readonly maxBytesPdf = MAX_BYTES_PDF;
  protected readonly subirPdf = (archivo: File): Observable<unknown> => {
    const actual = this.materiaSubida();
    return actual ? this.materias.subirContenidoTematico(actual.materia.id, archivo) : EMPTY;
  };

  constructor() {
    syncFilterForm(this.filtros, this.list);

    // Cada página cargada consulta, en segundo plano, si sus materias tienen PDF.
    // Cambiar de página cancela las consultas pendientes de la anterior.
    toObservable(this.list.page)
      .pipe(
        filter((page) => page !== null),
        switchMap((page) => {
          this.estados.set(new Map(page.items.map((m) => [m.id, 'consultando' as const])));
          return merge(...page.items.map((m) => this.consultar(m.id)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected estadoContenido(id: number): EstadoContenido {
    return this.estados().get(id) ?? 'consultando';
  }

  protected consultarContenido(id: number): void {
    this.consultar(id).subscribe();
  }

  private consultar(id: number): Observable<EstadoContenido> {
    this.fijarEstado(id, 'consultando');
    return this.materias.getContenidoTematico(id, { segundoPlano: true }).pipe(
      map((archivos): EstadoContenido => (archivos.length > 0 ? 'con' : 'sin')),
      catchError(() => of<EstadoContenido>('error')),
      tap((estado) => this.fijarEstado(id, estado)),
    );
  }

  private fijarEstado(id: number, estado: EstadoContenido): void {
    this.estados.update((actual) => new Map(actual).set(id, estado));
  }

  /**
   * Pide el contenido temático al hacer clic para que la URL firmada de S3 esté vigente
   * (vence en 1 hora); si hay varios PDFs, descarga el más reciente.
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
            this.fijarEstado(materia.id, 'sin');
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

  protected abrirSubida(materia: Materia, reemplazo: boolean): void {
    this.materiaSubida.set({ materia, reemplazo });
    this.dialogoSubida()?.abrir();
  }

  protected alSubirPdf(): void {
    const actual = this.materiaSubida();
    if (!actual) return;
    this.fijarEstado(actual.materia.id, 'con');
    this.notifications.success(
      actual.reemplazo
        ? `Se reemplazó el contenido temático de ${actual.materia.nombre}.`
        : `Se subió el contenido temático de ${actual.materia.nombre}.`,
    );
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
