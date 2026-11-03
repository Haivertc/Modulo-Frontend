import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { InscripcionesPageResponse } from '../../../models';
import { cerrarSesion, iniciarSesionComo } from '../../../../testing/session';
import { InscripcionesListComponent } from './inscripciones-list.component';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Respuesta con la forma real de `GET /api/inscripciones` (paginación en `metadata`). */
const PAGINA: InscripcionesPageResponse = {
  data: [
    {
      _id: '6501f8a2c9d4e5f6a7b8c9d1',
      estudianteId: '6501f8a2c9d4e5f6a7b8c9d0',
      cursoId: '1',
      periodo: '2026-2',
      estado: 'activa',
      notas: [
        { tipo: 'Parcial 1', valor: 4.2 },
        { tipo: 'Quiz 1', valor: 4.5 },
      ],
    },
    { _id: 'b', estudianteId: 'c', cursoId: '2', periodo: '2026-2', estado: 'cancelada', notas: [] },
  ],
  metadata: { total: 2, page: 1, totalPages: 1, pageSize: 20 },
};

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'inscripciones', component: InscripcionesListComponent }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const backend = TestBed.inject(HttpTestingController);
  const el = harness.fixture.nativeElement as HTMLElement;
  const stable = () => harness.fixture.whenStable();
  const flushList = async () => {
    const reqs = backend.match((r) => r.url === '/api/inscripciones');
    const req = reqs[reqs.length - 1];
    const params = Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));
    req.flush(PAGINA);
    await stable();
    return params;
  };
  return { el, stable, flushList, router: TestBed.inject(Router) };
}

describe('InscripcionesListComponent', () => {
  it('envía periodo, estudianteId y cursoId desde la URL y pinta la tabla', async () => {
    const { el, flushList } = await setup('/inscripciones?periodo=2026-2&estudianteId=6501f8a2c9d4e5f6a7b8c9d0&cursoId=1');

    expect(await flushList()).toEqual({
      pageNumber: '1',
      pageSize: '20',
      periodo: '2026-2',
      estudianteId: '6501f8a2c9d4e5f6a7b8c9d0',
      cursoId: '1',
    });

    const filas = el.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Parcial 1 4.2');
    expect(filas[0].querySelector('a')?.getAttribute('href')).toBe('/estudiantes/6501f8a2c9d4e5f6a7b8c9d0');
    expect(filas[1].textContent).toContain('Sin notas');
  });

  it('el filtro de periodo se sincroniza con la URL', async () => {
    const { el, flushList, stable, router } = await setup('/inscripciones');
    await flushList();

    const input = el.querySelector<HTMLInputElement>('#f-periodo')!;
    input.value = '2026-1';
    input.dispatchEvent(new Event('input'));
    await wait(400);
    await stable();

    expect(router.url).toBe('/inscripciones?periodo=2026-1');
    expect((await flushList())['periodo']).toBe('2026-1');
  });

  it('ordena por estado desde la cabecera', async () => {
    const { el, flushList, stable, router } = await setup('/inscripciones');
    await flushList();

    el.querySelector<HTMLButtonElement>('thead th:nth-child(2) button')!.click();
    await stable();
    expect(router.url).toBe('/inscripciones?sortBy=estado&sortDirection=asc');
    expect(await flushList()).toEqual({ pageNumber: '1', pageSize: '20', sortBy: 'estado', sortDirection: 'asc' });
  });
});

describe('InscripcionesListComponent: roles', () => {
  afterEach(() => cerrarSesion());

  it('ESTUDIANTE no ve Nueva, Editar ni Eliminar (ni la columna de acciones)', async () => {
    iniciarSesionComo('ESTUDIANTE');
    const { el, flushList } = await setup('/inscripciones');
    await flushList();

    expect(el.textContent).not.toContain('Nueva inscripción');
    expect(el.querySelector('.table__action')).toBeNull();
    expect(el.querySelectorAll('thead th').length).toBe(5);
  });

  it('ADMIN ve Nueva, Editar y Eliminar', async () => {
    iniciarSesionComo('ADMIN');
    const { el, flushList } = await setup('/inscripciones');
    await flushList();

    expect(el.textContent).toContain('Nueva inscripción');
    expect(el.querySelectorAll('a[href*="editar"]').length).toBe(2);
    expect(el.querySelectorAll('.link-button--danger').length).toBe(2);
  });
});
