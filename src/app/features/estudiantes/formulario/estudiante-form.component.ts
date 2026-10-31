import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { entityForm } from '../../../core/forms/entity-form';
import { EMAIL_PATTERN, ErrorMessages, fieldError, notFutureDate, requiredText } from '../../../core/forms/form-errors';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { Estudiante, EstudiantePayload, Programa } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';

const PHONE_PATTERN = /^\+?\d{7,15}$/;

const text = (max: number) =>
  new FormControl('', { nonNullable: true, validators: [Validators.required, requiredText, Validators.maxLength(max)] });

@Component({
  selector: 'app-estudiante-form',
  imports: [ReactiveFormsModule, RouterLink, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './estudiante-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstudianteFormComponent {
  private readonly estudiantes = inject(EstudiantesService);

  /** `:id` de la ruta `estudiantes/:id/editar`; vacío en `estudiantes/nuevo`. */
  readonly id = input<string>();

  protected readonly form = new FormGroup({
    nombre: text(100),
    apellido: text(100),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(EMAIL_PATTERN), Validators.maxLength(150)],
    }),
    fecha_nacimiento: new FormControl('', { nonNullable: true, validators: [Validators.required, notFutureDate] }),
    programa: new FormControl('', { nonNullable: true, validators: Validators.required }),
    contacto: new FormGroup({
      telefono: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(PHONE_PATTERN)],
      }),
      direccion: text(200),
      ciudad: text(100),
    }),
  });

  protected readonly entity = entityForm<Estudiante>({
    id: this.id,
    form: this.form,
    load: (id) => this.estudiantes.getEstudiante(id),
    fill: (e) =>
      this.form.setValue({
        nombre: e.nombre,
        apellido: e.apellido,
        correo: e.correo,
        fecha_nacimiento: e.fecha_nacimiento.slice(0, 10),
        programa: e.programa._id,
        contacto: { telefono: e.contacto.telefono, direccion: e.contacto.direccion, ciudad: e.contacto.ciudad },
      }),
    notFoundMessage: (id) => `No hay un estudiante con el ID ${id}.`,
  });

  protected readonly programas = toSignal(
    this.estudiantes.getProgramas().pipe(catchError(() => of<Programa[]>([]))),
    { initialValue: [] as Programa[] },
  );

  protected readonly messages: Record<string, ErrorMessages> = {
    correo: { pattern: 'Escribe un correo válido, por ejemplo nombre@dominio.com.' },
    fecha_nacimiento: { futureDate: 'La fecha de nacimiento no puede ser posterior a hoy.' },
    programa: { required: 'Elige un programa.' },
    telefono: { pattern: 'Escribe solo dígitos (7 a 15), con + opcional al inicio.' },
  };

  protected error(control: keyof typeof this.form.controls | 'telefono' | 'direccion' | 'ciudad'): string | null {
    const target =
      control === 'telefono' || control === 'direccion' || control === 'ciudad'
        ? this.form.controls.contacto.controls[control]
        : this.form.controls[control];
    return fieldError(target, this.messages[control]);
  }

  /** Cuerpo exacto que espera el módulo Estudiantes, con los textos recortados. */
  protected payload(): EstudiantePayload {
    const v = this.form.getRawValue();
    return {
      nombre: v.nombre.trim(),
      apellido: v.apellido.trim(),
      correo: v.correo.trim().toLowerCase(),
      fecha_nacimiento: v.fecha_nacimiento,
      programa: v.programa,
      contacto: {
        telefono: v.contacto.telefono.trim(),
        direccion: v.contacto.direccion.trim(),
        ciudad: v.contacto.ciudad.trim(),
      },
    };
  }

  protected submit(): void {
    if (!this.entity.validate()) return;
    const id = this.id();
    const payload = this.payload();
    this.entity.save(
      id ? this.estudiantes.updateEstudiante(id, payload) : this.estudiantes.createEstudiante(payload),
      {
        successMessage: id
          ? `Se guardaron los cambios de ${payload.nombre} ${payload.apellido}.`
          : `Se creó el estudiante ${payload.nombre} ${payload.apellido}.`,
        redirectTo: '/estudiantes',
      },
    );
  }
}
