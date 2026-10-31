import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, startWith, switchMap } from 'rxjs';

import { deleteAction } from '../../../core/feedback/delete-action';
import { LOADING, LoadState, toLoadState } from '../../../core/http/load-state';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { Estudiante, EstudianteDetalle, Nota } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';

/** Escala de calificación colombiana: 0.0 a 5.0, se aprueba con 3.0. */
const NOTA_MAXIMA = 5;
const NOTA_APROBATORIA = 3;

@Component({
  selector: 'app-estudiante-detalle',
  imports: [DecimalPipe, RouterLink, LoadingStateComponent, ErrorStateComponent],
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

  protected reload(): void {
    this.reload$.next();
  }

  protected eliminar(estudiante: Estudiante): void {
    const nombre = `${estudiante.nombre} ${estudiante.apellido}`;
    void this.deletion.run({
      key: estudiante._id,
      confirm: {
        title: `¿Eliminar a ${nombre}?`,
        message:
          'Se eliminará su perfil. Sus inscripciones no se eliminan: quedarán registradas con el ID de este estudiante. Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar estudiante',
      },
      request: () => this.estudiantes.deleteEstudiante(estudiante._id),
      successMessage: `Se eliminó a ${nombre}.`,
      onSuccess: () => void this.router.navigateByUrl('/estudiantes'),
    });
  }

  protected posicion(nota: Nota): number {
    return (Math.min(Math.max(nota.valor, 0), NOTA_MAXIMA) / NOTA_MAXIMA) * 100;
  }

  protected reprobada(nota: Nota): boolean {
    return nota.valor < NOTA_APROBATORIA;
  }
}
