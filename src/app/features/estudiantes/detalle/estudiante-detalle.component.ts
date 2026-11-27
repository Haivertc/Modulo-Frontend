import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, combineLatest, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { deleteAction } from '../../../core/feedback/delete-action';
import { NotificationService } from '../../../core/feedback/notification.service';
import { FORMATOS_FOTOGRAFIA, MAX_BYTES_FOTOGRAFIA } from '../../../core/files/formatos';
import { LOADING, LoadState, toLoadState } from '../../../core/http/load-state';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { Estudiante, EstudianteDetalle, Nota } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { FileUploadDialogComponent } from '../../../shared/ui/file-upload-dialog.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';

/** Escala de calificación colombiana: 0.0 a 5.0, se aprueba con 3.0. */
const NOTA_MAXIMA = 5;
const NOTA_APROBATORIA = 3;

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' });

@Component({
  selector: 'app-estudiante-detalle',
  imports: [DecimalPipe, RouterLink, LoadingStateComponent, ErrorStateComponent, FileUploadDialogComponent],
  templateUrl: './estudiante-detalle.component.html',
  styleUrl: './estudiante-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstudianteDetalleComponent {
  private readonly estudiantes = inject(EstudiantesService);
  private readonly router = inject(Router);
  private readonly reload$ = new Subject<void>();

  /** Parámetro `:id` de la ruta, enlazado con `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly state = toSignal(
    combineLatest([toObservable(this.id), this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([id]) =>
        toLoadState(
          this.estudiantes.getDetalle(id),
          `No hay un estudiante con el ID ${id}. Revisa el ID en la dirección.`,
        ),
      ),
    ),
    { initialValue: LOADING as LoadState<EstudianteDetalle> },
  );

  protected readonly loading = computed(() => this.state().status === 'loading');
  protected readonly error = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.error : null;
  });
  protected readonly detalle = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });

  protected readonly notaAprobatoria = NOTA_APROBATORIA;
  protected readonly umbralPorcentaje = (NOTA_APROBATORIA / NOTA_MAXIMA) * 100;

  protected readonly deletion = deleteAction();

  /** Solo ADMIN ve Editar, Desactivar y la subida de foto (el Gateway rechaza la escritura con 403). */
  protected readonly esAdmin = inject(AuthService).esAdmin;
  private readonly notifications = inject(NotificationService);

  // ---------- Fotografía (S3) ----------

  /** La URL firmada vence en 1 hora: si la imagen no carga se muestran las iniciales. */
  protected readonly fotoFallida = signal(false);
  protected readonly formatosFoto = FORMATOS_FOTOGRAFIA;
  protected readonly maxBytesFoto = MAX_BYTES_FOTOGRAFIA;
  protected readonly subirFoto = (archivo: File): Observable<unknown> =>
    this.estudiantes.subirFotografia(this.id(), archivo);

  protected alSubirFoto(): void {
    this.notifications.success('Se actualizó la fotografía.');
    // Se recarga el detalle para obtener la nueva URL firmada desde el Gateway
    this.reload();
  }

  protected reload(): void {
    this.fotoFallida.set(false);
    this.reload$.next();
  }

  /** El DELETE no borra: deja al estudiante INACTIVO. */
  protected desactivar(estudiante: Estudiante): void {
    const nombre = `${estudiante.nombre} ${estudiante.apellido}`;
    void this.deletion.run({
      key: estudiante._id,
      confirm: {
        title: `¿Desactivar a ${nombre}?`,
        message:
          'Quedará en estado INACTIVO y no podrá inscribirse en nuevos cursos. Su perfil y sus inscripciones se conservan.',
        confirmLabel: 'Desactivar estudiante',
      },
      request: () => this.estudiantes.deleteEstudiante(estudiante._id),
      successMessage: `Se desactivó a ${nombre}.`,
      onSuccess: () => void this.router.navigateByUrl('/estudiantes'),
    });
  }

  /**
   * "2003-05-20T00:00:00.000Z" -> "20 de mayo de 2003". Se formatea en UTC: la fecha se guarda
   * a medianoche UTC y en la zona horaria de Colombia se mostraría como el día anterior.
   */
  protected fechaNacimiento(iso: string): string {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA.format(fecha);
  }

  protected posicion(nota: Nota): number {
    return (Math.min(Math.max(nota.valor, 0), NOTA_MAXIMA) / NOTA_MAXIMA) * 100;
  }

  protected reprobada(nota: Nota): boolean {
    return nota.valor < NOTA_APROBATORIA;
  }
}
