import type { Contacto } from './contacto.model';

/** Cuerpo de `POST /api/estudiantes` y `PUT /api/estudiantes/:id`. */
export interface EstudiantePayload {
  nombre: string;
  apellido: string;
  correo: string;
  /** Fecha `YYYY-MM-DD`; el módulo la convierte a `Date`. */
  fecha_nacimiento: string;
  /** `_id` del programa. */
  programa: string;
  contacto: Contacto;
}

/** Cuerpo de `POST /api/materias` y `PUT /api/materias/{id}` (MateriaCreateRequest / MateriaUpdateRequest). */
export interface MateriaPayload {
  nombre: string;
  descripcion: string | null;
  creditos: number;
  programa: string;
}

/** Cuerpo de `POST /api/inscripciones`: el estado no se acepta al crear (nace como "activa"). */
export interface InscripcionCreatePayload {
  estudianteId: string;
  cursoId: string;
  periodo: string;
}

/** Cuerpo de `PUT /api/inscripciones/:id`. */
export interface InscripcionUpdatePayload extends InscripcionCreatePayload {
  estado: string;
}
