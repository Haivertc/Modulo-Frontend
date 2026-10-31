import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { entityForm } from '../../../core/forms/entity-form';
import {
  ErrorMessages,
  OBJECT_ID_PATTERN,
  fieldError,
  positiveInteger,
  requiredText,
} from '../../../core/forms/form-errors';
import { InscripcionesService } from '../../../core/services/inscripciones.service';
import { InscripcionCreatePayload, InscripcionResumen, InscripcionUpdatePayload } from '../../../models';
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
    estado: new FormControl('', { nonNullable: true, validators: [Validators.required, requiredText] }),
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

  constructor() {
    effect(() => {
      const estado = this.form.controls.estado;
      untracked(() => (this.entity.editing() ? estado.enable() : estado.disable()));
    });
  }

  protected error(control: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[control], this.messages[control]);
  }

  protected createPayload(): InscripcionCreatePayload {
    const v = this.form.getRawValue();
    return { estudianteId: v.estudianteId.trim(), cursoId: v.cursoId.trim(), periodo: v.periodo.trim() };
  }

  protected updatePayload(): InscripcionUpdatePayload {
    return { ...this.createPayload(), estado: this.form.getRawValue().estado.trim() };
  }

  protected submit(): void {
    if (!this.entity.validate()) return;
    const id = this.id();
    this.entity.save(
      id
        ? this.inscripciones.updateInscripcion(id, this.updatePayload())
        : this.inscripciones.createInscripcion(this.createPayload()),
      {
        successMessage: id ? 'Se guardaron los cambios de la inscripción.' : 'Se creó la inscripción.',
        redirectTo: '/inscripciones',
      },
    );
  }
}
