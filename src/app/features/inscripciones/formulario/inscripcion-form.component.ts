import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { entityForm } from '../../../core/forms/entity-form';
import {
  ErrorMessages,
  OBJECT_ID_PATTERN,
  fieldError,
  positiveInteger,
} from '../../../core/forms/form-errors';
import { isRetryableError } from '../../../core/http/gateway-error';
import { newIdempotencyKey } from '../../../core/http/idempotency-key';
import { InscripcionesService } from '../../../core/services/inscripciones.service';
import { EstadoInscripcion, InscripcionCreatePayload, InscripcionResumen, InscripcionUpdatePayload } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';

/** Periodo académico `AAAA-1` o `AAAA-2`, como los que usa el módulo (p. ej. "2026-2"). */
const PERIODO_PATTERN = /^\d{4}-[12]$/;

@Component({
  selector: 'app-inscripcion-form',
  imports: [ReactiveFormsModule, RouterLink, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './inscripcion-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InscripcionFormComponent {
  private readonly inscripciones = inject(InscripcionesService);

  /** `:id` de la ruta `inscripciones/:id/editar`; vacío en `inscripciones/nuevo`. */
  readonly id = input<string>();

  protected readonly form = new FormGroup({
    estudianteId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(OBJECT_ID_PATTERN)],
    }),
    cursoId: new FormControl('', { nonNullable: true, validators: positiveInteger }),
    periodo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(PERIODO_PATTERN)],
    }),
    // Solo editable al actualizar: el módulo no acepta `estado` al crear.
    estado: new FormControl<EstadoInscripcion>('activa', { nonNullable: true, validators: Validators.required }),
  });

  protected readonly entity = entityForm<InscripcionResumen>({
    id: this.id,
    form: this.form,
    load: (id) => this.inscripciones.getInscripcion(id),
    fill: (i) => this.form.setValue({ estudianteId: i.estudianteId, cursoId: i.cursoId, periodo: i.periodo, estado: i.estado }),
    notFoundMessage: (id) => `No hay una inscripción con el ID ${id}.`,
  });

  protected readonly messages: Record<string, ErrorMessages> = {
    estudianteId: { pattern: 'El ID de estudiante tiene 24 caracteres hexadecimales (0-9, a-f).' },
    cursoId: { pattern: 'El ID de curso es un número entero positivo, por ejemplo 1.' },
    periodo: { pattern: 'Usa el formato AAAA-1 o AAAA-2, por ejemplo 2026-2.' },
  };

  /**
   * Clave del intento de creación en curso. Se conserva entre reintentos tras un fallo de red
   * o 503 (el módulo pudo haber creado la inscripción) y se descarta tras un éxito, otro error
   * o cualquier cambio en el formulario, porque entonces es un intento distinto.
   */
  private idempotencyKey: string | null = null;

  constructor() {
    effect(() => {
      const { estudianteId, cursoId, estado } = this.form.controls;
      const editing = this.entity.editing();
      untracked(() => {
        // Al editar solo cambian periodo y estado: el módulo responde CambioNoPermitido si
        // se intenta mover la inscripción a otro estudiante o curso.
        if (editing) {
          estudianteId.disable();
          cursoId.disable();
          estado.enable();
        } else {
          estudianteId.enable();
          cursoId.enable();
          estado.disable();
        }
      });
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => (this.idempotencyKey = null));
  }

  protected error(control: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[control], this.messages[control]);
  }

  protected createPayload(): InscripcionCreatePayload {
    const v = this.form.getRawValue();
    return { estudianteId: v.estudianteId.trim(), cursoId: v.cursoId.trim(), periodo: v.periodo.trim() };
  }

  protected updatePayload(): InscripcionUpdatePayload {
    return { ...this.createPayload(), estado: this.form.getRawValue().estado };
  }

  protected submit(): void {
    if (this.entity.saving() || !this.entity.validate()) return;
    const id = this.id();
    this.entity.save(
      id ? this.inscripciones.updateInscripcion(id, this.updatePayload()) : this.create(),
      {
        successMessage: id ? 'Se guardaron los cambios de la inscripción.' : 'Se creó la inscripción.',
        redirectTo: '/inscripciones',
      },
    );
  }

  private create(): Observable<InscripcionResumen> {
    const key = (this.idempotencyKey ??= newIdempotencyKey());
    return this.inscripciones.createInscripcion(this.createPayload(), key).pipe(
      tap({
        next: () => (this.idempotencyKey = null),
        error: (error: unknown) => {
          if (!isRetryableError(error)) this.idempotencyKey = null;
        },
      }),
    );
  }
}
