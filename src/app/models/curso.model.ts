import type { Docente } from './docente.model';

/** Curso (PostgreSQL, módulo Materias) con su docente compuesto por el Gateway. */
export interface Curso {
  id: number;
  materiaId: number;
  materiaNombre: string;
  docenteId: number;
  horario: string;
  periodo: string;
  cupo: number;
  aula: string;
  modalidad: string;
  estado: string;
  docente: Docente;
}
