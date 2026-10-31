import type { Estudiante } from './estudiante.model';
import type { Inscripcion } from './inscripcion.model';

/** Respuesta de composición BFF de `GET /api/estudiantes/{id}/detalle`. */
export interface EstudianteDetalle {
  estudiante: Estudiante;
  inscripciones: Inscripcion[];
}
