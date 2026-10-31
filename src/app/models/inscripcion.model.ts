import type { Curso } from './curso.model';
import type { Nota } from './nota.model';

/** Inscripción (módulo Inscripciones) con su curso compuesto por el Gateway. */
export interface Inscripcion {
  _id: string;
  estudianteId: string;
  /** Llega como texto (p. ej. "1") aunque `Curso.id` es numérico. */
  cursoId: string;
  periodo: string;
  estado: string;
  curso: Curso;
  notas: Nota[];
}
