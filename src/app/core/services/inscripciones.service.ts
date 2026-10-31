import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  InscripcionCreatePayload,
  InscripcionResumen,
  InscripcionUpdatePayload,
  InscripcionesFiltros,
  InscripcionesPageResponse,
  PaginatedResponse,
  SortDirection,
} from '../../models';
import { APP_CONFIG } from '../config/app-config';
import { toHttpParams } from '../http/query-params';

@Injectable({ providedIn: 'root' })
export class InscripcionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/inscripciones`;

  /** Listado paginado (base 1). El módulo devuelve la paginación dentro de `metadata`. */
  getInscripciones(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filtros: InscripcionesFiltros = {},
  ): Observable<PaginatedResponse<InscripcionResumen>> {
    const params = toHttpParams({ pageNumber, pageSize, sortBy, sortDirection, ...filtros });

    return this.http.get<InscripcionesPageResponse>(this.baseUrl, { params }).pipe(
      map(({ data, metadata }) => ({
        items: data,
        totalElements: metadata.total,
        pageNumber: metadata.page,
        pageSize: metadata.pageSize,
        totalPages: metadata.totalPages,
      })),
    );
  }

  getInscripcion(id: string): Observable<InscripcionResumen> {
    return this.http.get<InscripcionResumen>(this.url(id));
  }

  createInscripcion(payload: InscripcionCreatePayload): Observable<InscripcionResumen> {
    return this.http.post<InscripcionResumen>(this.baseUrl, payload);
  }

  updateInscripcion(id: string, payload: InscripcionUpdatePayload): Observable<InscripcionResumen> {
    return this.http.put<InscripcionResumen>(this.url(id), payload);
  }

  /** El módulo también elimina las notas y el historial de la inscripción. */
  deleteInscripcion(id: string): Observable<void> {
    return this.http.delete(this.url(id)).pipe(map(() => undefined));
  }

  private url(id: string): string {
    return `${this.baseUrl}/${encodeURIComponent(id)}`;
  }
}
