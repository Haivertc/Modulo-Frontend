/** Docente (PostgreSQL, módulo Materias). */
export interface Docente {
  id: number;
  nombres: string;
  apellidos: string;
  correoInstitucional: string;
  especialidad: string;
  activo: boolean;
}
