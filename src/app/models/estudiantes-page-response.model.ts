import type { Estudiante } from './estudiante.model';

/** Respuesta de `GET /api/estudiantes` tal como la entrega el módulo Estudiantes. */
export interface EstudiantesPageResponse {
  totalRecords: number;
  /** Base 1. */
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  data: Estudiante[];
}
