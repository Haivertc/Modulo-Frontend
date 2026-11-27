import type { Docente } from './docente.model';

/** Un DELETE no borra el curso: lo deja INACTIVO. */
export type EstadoCurso = 'ACTIVO' | 'INACTIVO' | 'CANCELADO';

/** Curso (PostgreSQL, módulo Materias) con su docente compuesto por el Gateway. */
export interface Curso {
  id: number;
  materiaId: number;
  materiaNombre: string;
  docenteId: number;
  horario: string;
  periodo: string;
  /** Cupo máximo (capacidad del curso). */
  cupo: number;
  /** Puestos libres; el módulo Materias lo descuenta al inscribir y lo libera al cancelar. */
  cupoDisponible: number;
  aula: string;
  modalidad: string;
  estado: EstadoCurso;
  docente: Docente;
}
