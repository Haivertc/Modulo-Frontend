import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PaginatedResponse } from '../../models';
import { EstudiantesService } from './estudiantes.service';
import { InscripcionesService } from './inscripciones.service';
import { MateriasService } from './materias.service';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { backend: TestBed.inject(HttpTestingController) };
}

const params = (req: { request: { params: { keys(): string[]; get(k: string): string | null } } }) =>
  Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));

describe('Adaptadores de paginación', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('Estudiantes: envía filtros y orden, y mapea data/totalRecords', () => {
    const { backend } = setup();
    let page: PaginatedResponse<unknown> | undefined;
    TestBed.inject(EstudiantesService)
      .getEstudiantes(2, 10, 'apellido', 'desc', { search: 'gómez', programa: 'p1', ciudad: undefined })
      .subscribe((p) => (page = p));

    const req = backend.expectOne((r) => r.url === '/api/estudiantes');
    expect(params(req)).toEqual({
      pageNumber: '2',
      pageSize: '10',
      sortBy: 'apellido',
      sortDirection: 'desc',
      search: 'gómez',
      programa: 'p1',
    });
    req.flush({ totalRecords: 11, pageNumber: 2, pageSize: 10, totalPages: 2, data: [{ _id: 'x' }] });
    expect(page).toEqual({ items: [{ _id: 'x' }], totalElements: 11, pageNumber: 2, pageSize: 10, totalPages: 2 });
  });

  it('Materias: convierte pageNumber a base 0 al pedir y a base 1 al responder; mapea content', () => {
    const { backend } = setup();
    let page: PaginatedResponse<unknown> | undefined;
    TestBed.inject(MateriasService)
      .getMaterias(1, 20, 'creditos', 'asc', { nombre: 'sist', creditos: 4, programa: 'ingeniería' })
      .subscribe((p) => (page = p));

    const req = backend.expectOne((r) => r.url === '/api/materias');
    expect(params(req)).toEqual({
      pageNumber: '0',
      pageSize: '20',
      sortBy: 'creditos',
      sortDirection: 'asc',
      nombre: 'sist',
      creditos: '4',
      programa: 'ingeniería',
    });
    req.flush({ content: [{ id: 1 }], pageNumber: 0, pageSize: 20, totalElements: 1, totalPages: 1 });
    expect(page).toEqual({ items: [{ id: 1 }], totalElements: 1, pageNumber: 1, pageSize: 20, totalPages: 1 });
  });

  it('Inscripciones: envía filtros exactos y mapea data + metadata', () => {
    const { backend } = setup();
    let page: PaginatedResponse<unknown> | undefined;
    TestBed.inject(InscripcionesService)
      .getInscripciones(3, 50, undefined, undefined, { periodo: '2026-2', estudianteId: 'abc', cursoId: '' })
      .subscribe((p) => (page = p));

    const req = backend.expectOne((r) => r.url === '/api/inscripciones');
    expect(params(req)).toEqual({ pageNumber: '3', pageSize: '50', periodo: '2026-2', estudianteId: 'abc' });
    req.flush({ data: [{ _id: 'i' }], metadata: { total: 101, page: 3, totalPages: 3, pageSize: 50 } });
    expect(page).toEqual({ items: [{ _id: 'i' }], totalElements: 101, pageNumber: 3, pageSize: 50, totalPages: 3 });
  });

  it('Inscripciones: createInscripcion envía la clave en el encabezado Idempotency-Key', () => {
    const { backend } = setup();
    const payload = { estudianteId: 'abc', cursoId: '1', periodo: '2026-2' };
    TestBed.inject(InscripcionesService).createInscripcion(payload, 'clave-123').subscribe();

    const req = backend.expectOne('/api/inscripciones');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-123');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('Estudiantes: consulta los programas en /api/estudiantes/programas', () => {
    const { backend } = setup();
    TestBed.inject(EstudiantesService).getProgramas().subscribe();
    backend.expectOne('/api/estudiantes/programas').flush([]);
  });
});
