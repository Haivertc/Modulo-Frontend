import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap, throwError } from 'rxjs';

import { entityForm } from '../../../core/forms/entity-form';
import { ErrorMessages, fieldError, positiveInteger, requiredText } from '../../../core/forms/form-errors';
import { EstudiantesService } from '../../../core/services/estudiantes.service';
import { MateriasService } from '../../../core/services/materias.service';
import { Materia, MateriaPayload } from '../../../models';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state.component';

/** Límites de MateriaCreateRequest / MateriaUpdateRequest en el módulo Materias. */
const MAX_NOMBRE = 150;
const MAX_DESCRIPCION = 1000;
const MAX_PROGRAMA = 150;

@Component({
  selector: 'app-materia-form',
  imports: [ReactiveFormsModule, RouterLink, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './materia-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriaFormComponent {
  private readonly materias = inject(MateriasService);
  private readonly estudiantes = inject(EstudiantesService);

  /** `:id` de la ruta `materias/:id/editar`; vacío en `materias/nuevo`. */
  readonly id = input<string>();

  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, requiredText, Validators.maxLength(MAX_NOMBRE)],
    }),
    creditos: new FormControl('', { nonNullable: true, validators: positiveInteger }),
    programa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, requiredText, Validators.maxLength(MAX_PROGRAMA)],
    }),
    descripcion: new FormControl('', { nonNullable: true, validators: Validators.maxLength(MAX_DESCRIPCION) }),
  });

  protected readonly entity = entityForm<Materia>({
    id: this.id,
    form: this.form,
    // Un ID no numérico no puede existir en Materias (PostgreSQL): se trata como no encontrado sin llamar al API.
    load: (id) =>
      /^\d+$/.test(id)
        ? this.materias.getMateria(Number(id))
        : throwError(() => new HttpErrorResponse({ status: 404, url: `/api/materias/${id}` })),
    fill: (m) =>
      this.form.setValue({
        nombre: m.nombre,
        creditos: String(m.creditos),
        programa: m.programa,
        descripcion: m.descripcion ?? '',
      }),
    notFoundMessage: (id) => `No hay una materia con el ID ${id}.`,
  });

  /**
   * Opciones del campo Programa: el catálogo del módulo Estudiantes. En Materias el programa es
   * texto, así que el selector garantiza que solo se guarden nombres de programas existentes.
   */
  private readonly recargaProgramas$ = new Subject<void>();
  private readonly programasCarga = toSignal(
    this.recargaProgramas$.pipe(
      startWith(undefined),
      switchMap(() =>
        this.estudiantes.getProgramas().pipe(
          map((list) => ({ estado: 'listo' as const, nombres: list.map((p) => p.nombre) })),
          catchError(() => of({ estado: 'error' as const, nombres: [] as string[] })),
          startWith({ estado: 'cargando' as const, nombres: [] as string[] }),
        ),
      ),
    ),
    { initialValue: { estado: 'cargando' as const, nombres: [] as string[] } },
  );
  protected readonly programasEstado = computed(() => this.programasCarga().estado);

  private readonly programaActual = toSignal(this.form.controls.programa.valueChanges, {
    initialValue: this.form.controls.programa.value,
  });
  /**
   * Al editar una materia antigua cuyo programa no está en el catálogo, se conserva como
   * opción (marcada) para no perder el dato; al crear solo se ofrecen programas del catálogo.
   */
  protected readonly programaFueraDeCatalogo = computed(() => {
    const actual = this.programaActual();
    const { estado, nombres } = this.programasCarga();
    return actual && estado === 'listo' && !nombres.includes(actual) ? actual : null;
  });
  protected readonly opcionesPrograma = computed(() => {
    const { nombres } = this.programasCarga();
    const actual = this.programaActual();
    // Mientras carga (o si falló) el valor actual sigue visible y seleccionado
    return actual && !nombres.includes(actual) ? [actual, ...nombres] : nombres;
  });

  protected recargarProgramas(): void {
    this.recargaProgramas$.next();
  }

  protected readonly maxDescripcion = MAX_DESCRIPCION;
  protected readonly messages: Record<string, ErrorMessages> = {
    nombre: { maxlength: `Máximo ${MAX_NOMBRE} caracteres.` },
    creditos: { pattern: 'Escribe un número entero positivo, por ejemplo 3.' },
    programa: { required: 'Selecciona un programa.', maxlength: `Máximo ${MAX_PROGRAMA} caracteres.` },
    descripcion: { maxlength: `Máximo ${MAX_DESCRIPCION} caracteres.` },
  };

  protected error(control: keyof typeof this.form.controls): string | null {
    return fieldError(this.form.controls[control], this.messages[control]);
  }

  /** Cuerpo de MateriaCreateRequest / MateriaUpdateRequest; una descripción vacía se envía como `null`. */
  protected payload(): MateriaPayload {
    const v = this.form.getRawValue();
    return {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      creditos: Number(v.creditos),
      programa: v.programa.trim(),
    };
  }

  protected submit(): void {
    if (!this.entity.validate()) return;
    const id = this.id();
    const payload = this.payload();
    this.entity.save(
      id ? this.materias.updateMateria(Number(id), payload) : this.materias.createMateria(payload),
      {
        successMessage: id ? `Se guardaron los cambios de ${payload.nombre}.` : `Se creó la materia ${payload.nombre}.`,
        redirectTo: '/materias',
      },
    );
  }
}
