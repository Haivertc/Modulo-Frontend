import type { InscripcionResumen } from './inscripcion-resumen.model';

/** Respuesta de `GET /api/inscripciones` tal como la entrega el módulo Inscripciones. */
export interface InscripcionesPageResponse {
  data: InscripcionResumen[];
  metadata: {
    total: number;
    /** Base 1. */
    page: number;
    totalPages: number;
    pageSize: number;
  };
}
