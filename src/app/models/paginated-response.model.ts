/**
 * Página normalizada que consume la interfaz. Cada módulo pagina con una forma distinta
 * (Estudiantes: `data`/`totalRecords`; Materias: `content`/`totalElements`, base 0),
 * así que cada servicio adapta su respuesta a esta estructura.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalElements: number;
  /** Base 1. */
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export type SortDirection = 'asc' | 'desc';
