import type { Nota } from './nota.model';

/**
 * Inscripción tal como la lista `GET /api/inscripciones`: sin composición del Gateway,
 * así que trae `cursoId` pero no el objeto `curso`.
 */
export interface InscripcionResumen {
  _id: string;
  estudianteId: string;
  cursoId: string;
  periodo: string;
  estado: string;
  notas: Nota[];
}
