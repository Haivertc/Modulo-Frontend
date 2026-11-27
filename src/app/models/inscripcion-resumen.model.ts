import type { Nota } from './nota.model';

/** Un DELETE no borra la inscripción: la deja «cancelada» y libera el cupo del curso. */
export type EstadoInscripcion = 'activa' | 'cancelada';

/**
 * Inscripción tal como la lista `GET /api/inscripciones`: sin composición del Gateway,
 * así que trae `cursoId` pero no el objeto `curso`.
 */
export interface InscripcionResumen {
  _id: string;
  estudianteId: string;
  cursoId: string;
  periodo: string;
  estado: EstadoInscripcion;
  notas: Nota[];
}
