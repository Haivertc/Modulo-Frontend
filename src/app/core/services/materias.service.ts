import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ContenidoTematico,
  Materia,
  MateriaPayload,
  MateriasFiltros,
  MateriasPageResponse,
  PaginatedResponse,
  SortDirection,
} from '../../models';
import { APP_CONFIG } from '../config/app-config';
import { toHttpParams } from '../http/query-params';

@Injectable({ providedIn: 'root' })
export class MateriasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/materias`;

  /**
   * Listado paginado. Recibe `pageNumber` en base 1 (como el resto de la interfaz) y lo
   * convierte a la base 0 que usa el módulo Materias; la respuesta vuelve a base 1.
   */
  getMaterias(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filtros: MateriasFiltros = {},
  ): Observable<PaginatedResponse<Materia>> {
    const params = toHttpParams({ pageNumber: pageNumber - 1, pageSize, sortBy, sortDirection, ...filtros });

    return this.http.get<MateriasPageResponse>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.content,
        totalElements: response.totalElements,
        pageNumber: response.pageNumber + 1,
        pageSize: response.pageSize,
        totalPages: response.totalPages,
      })),
    );
  }

  getMateria(id: number): Observable<Materia> {
    return this.http.get<Materia>(`${this.baseUrl}/${id}`);
  }

  createMateria(payload: MateriaPayload): Observable<Materia> {
    return this.http.post<Materia>(this.baseUrl, payload);
  }

  updateMateria(id: number, payload: MateriaPayload): Observable<Materia> {
    return this.http.put<Materia>(`${this.baseUrl}/${id}`, payload);
  }

  deleteMateria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** PDFs de contenido temático de la materia, en orden de subida, cada uno con su URL firmada. */
  getContenidoTematico(id: number): Observable<ContenidoTematico[]> {
    return this.http.get<ContenidoTematico[]>(`${this.baseUrl}/${id}/contenido-tematico`);
  }
}
