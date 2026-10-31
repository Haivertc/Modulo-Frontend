import type { Materia } from './materia.model';

/** Respuesta de `GET /api/materias` tal como la entrega el módulo Materias (`PageResponse` de Spring). */
export interface MateriasPageResponse {
  content: Materia[];
  /** Base 0. */
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}
