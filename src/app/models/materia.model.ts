/** Materia (PostgreSQL, módulo Materias). Campos según `MateriaResponse` del servicio. */
export interface Materia {
  id: number;
  nombre: string;
  descripcion: string;
  creditos: number;
  /** Nombre del programa académico (texto, no referencia a `Programa`). */
  programa: string;
}
