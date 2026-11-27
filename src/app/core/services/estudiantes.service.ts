import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  Estudiante,
  EstudianteDetalle,
  EstudiantePayload,
  EstudiantesFiltros,
  EstudiantesPageResponse,
  PaginatedResponse,
  Programa,
  SortDirection,
} from '../../models';
import { APP_CONFIG } from '../config/app-config';
import { toHttpParams } from '../http/query-params';

@Injectable({ providedIn: 'root' })
export class EstudiantesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/estudiantes`;

  /** Listado paginado. `pageNumber` es base 1, igual que en el módulo Estudiantes. */
  getEstudiantes(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filtros: EstudiantesFiltros = {},
  ): Observable<PaginatedResponse<Estudiante>> {
    const params = toHttpParams({ pageNumber, pageSize, sortBy, sortDirection, ...filtros });

    return this.http.get<EstudiantesPageResponse>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.data,
        totalElements: response.totalRecords,
        pageNumber: response.pageNumber,
        pageSize: response.pageSize,
        totalPages: response.totalPages,
      })),
    );
  }

  getEstudiante(id: string): Observable<Estudiante> {
    return this.http.get<Estudiante>(this.url(id));
  }

  /** La respuesta trae `programa` como ID (sin populate), así que no se expone. */
  createEstudiante(payload: EstudiantePayload): Observable<void> {
    return this.http.post(this.baseUrl, payload).pipe(map(() => undefined));
  }

  updateEstudiante(id: string, payload: EstudiantePayload): Observable<void> {
    return this.http.put(this.url(id), payload).pipe(map(() => undefined));
  }

  /** No borra: deja al estudiante INACTIVO; sus inscripciones se conservan. */
  deleteEstudiante(id: string): Observable<void> {
    return this.http.delete<void>(this.url(id));
  }

  /** Programas académicos (sub-recurso del módulo Estudiantes). */
  getProgramas(): Observable<Programa[]> {
    return this.http.get<Programa[]>(`${this.baseUrl}/programas`);
  }

  /**
   * Sube o reemplaza la fotografía (campo `fotografia`, JPG/PNG, máx. 2 MB). El módulo la
   * envía directo a AWS S3 y responde el estudiante con `fotografia.url` firmada.
   */
  subirFotografia(id: string, archivo: File): Observable<Estudiante> {
    const datos = new FormData();
    datos.append('fotografia', archivo, archivo.name);
    return this.http.post<Estudiante>(`${this.url(id)}/fotografia`, datos);
  }

  /** Composición BFF del Gateway: estudiante con sus inscripciones, cursos, docentes y notas. */
  getDetalle(id: string): Observable<EstudianteDetalle> {
    return this.http.get<EstudianteDetalle>(`${this.url(id)}/detalle`);
  }

  private url(id: string): string {
    return `${this.baseUrl}/${encodeURIComponent(id)}`;
  }
}
