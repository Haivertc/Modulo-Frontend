import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { EstudiantesPageResponse } from '../../../models';
import { cerrarSesion, iniciarSesionComo } from '../../../../testing/session';
import { EstudiantesListComponent } from './estudiantes-list.component';

const DEBOUNCE = 400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Respuesta con la forma real de `GET /api/estudiantes`. */
function pagina(pageNumber: number, totalRecords = 45, pageSize = 20): EstudiantesPageResponse {
  const count = Math.max(0, Math.min(pageSize, totalRecords - (pageNumber - 1) * pageSize));
  return {
    totalRecords,
    pageNumber,
    pageSize,
    totalPages: Math.ceil(totalRecords / pageSize),
    data: Array.from({ length: count }, (_, i) => ({
      _id: `id-${pageNumber}-${i}`,
      nombre: `Nombre ${i}`,
      apellido: `Apellido ${i}`,
      correo: `persona${i}@ejemplo.com`,
      fecha_nacimiento: '2003-05-20T00:00:00.000Z',
      programa: { _id: 'p1', nombre: 'Ingeniería de Sistemas', codigo: 'ISC-01', facultad: 'Ingeniería' },
      contacto: { telefono: '3001234567', direccion: 'Calle 10', ciudad: 'Sogamoso' },
      estado: i === 1 ? ('INACTIVO' as const) : ('ACTIVO' as const),
    })),
  };
}

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'estudiantes', component: EstudiantesListComponent }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const backend = TestBed.inject(HttpTestingController);
  backend.expectOne('/api/estudiantes/programas').flush([
    { _id: 'p1', nombre: 'Ingeniería de Sistemas', codigo: 'ISC-01', facultad: 'Ingeniería' },
    { _id: 'p2', nombre: 'Medicina', codigo: 'MED-01', facultad: 'Salud' },
  ]);
  const el = harness.fixture.nativeElement as HTMLElement;
  const stable = () => harness.fixture.whenStable();
  /** Responde la última petición del listado y devuelve sus parámetros. */
  const flushList = async (body = pagina(1)) => {
    const reqs = backend.match((r) => r.url === '/api/estudiantes');
    const req: TestRequest = reqs[reqs.length - 1];
    const params = Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));
    req.flush(body);
    await stable();
    return params;
  };
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  return { el, stable, flushList, type, router: TestBed.inject(Router) };
}

describe('EstudiantesListComponent', () => {
  it('lee página, orden y filtros de la URL, los envía como HttpParams y rellena el formulario', async () => {
    const { el, flushList } = await setup(
      '/estudiantes?search=g%C3%B3mez&programa=p1&ciudad=Tunja&pageNumber=2&pageSize=10&sortBy=apellido&sortDirection=desc',
    );

    expect(await flushList(pagina(2, 45, 10))).toEqual({
      pageNumber: '2',
      pageSize: '10',
      sortBy: 'apellido',
      sortDirection: 'desc',
      search: 'gómez',
      programa: 'p1',
      ciudad: 'Tunja',
    });
    expect(el.querySelector<HTMLInputElement>('#f-search')!.value).toBe('gómez');
    expect(el.querySelector<HTMLSelectElement>('#f-programa')!.value).toBe('p1');
    expect(el.querySelector<HTMLInputElement>('#f-ciudad')!.value).toBe('Tunja');
    expect(el.querySelectorAll('tbody tr').length).toBe(10);
    expect(el.querySelector('th[aria-sort="descending"]')?.textContent).toContain('Apellido');
  });

  it('muestra el estado de cada estudiante y atenúa los INACTIVO', async () => {
    const { el, flushList } = await setup('/estudiantes');
    await flushList(pagina(1));

    const [activo, inactivo] = el.querySelectorAll('tbody tr');
    expect(activo.querySelector('td[data-label="Estado"]')?.textContent?.trim()).toBe('ACTIVO');
    expect(activo.querySelector('.status--off')).toBeNull();
    expect(inactivo.querySelector('td[data-label="Estado"] .status--off')?.textContent?.trim()).toBe('INACTIVO');
  });

  it('al filtrar actualiza la URL, vuelve a la página 1 y pide con el nuevo filtro', async () => {
    const { flushList, type, stable, router } = await setup('/estudiantes?pageNumber=3');
    await flushList(pagina(3));

    type('#f-search', '  Laura ');
    await wait(DEBOUNCE);
    await stable();
    expect(router.url).toBe('/estudiantes?search=Laura');

    expect(await flushList()).toEqual({ pageNumber: '1', pageSize: '20', search: 'Laura' });

    type('#f-programa', 'p2');
    await wait(DEBOUNCE);
    await stable();
    expect(router.url).toBe('/estudiantes?search=Laura&programa=p2');
    expect(await flushList()).toEqual({ pageNumber: '1', pageSize: '20', search: 'Laura', programa: 'p2' });
  });

  it('un cambio de URL ajeno al formulario (Atrás, enlace compartido) lo actualiza y vuelve a pedir', async () => {
    const { el, flushList, type, stable, router } = await setup('/estudiantes?ciudad=Tunja');
    await flushList();

    type('#f-ciudad', 'Duitama');
    await wait(DEBOUNCE);
    await stable();
    await flushList();
    expect(router.url).toBe('/estudiantes?ciudad=Duitama');

    // Equivale a lo que provoca el botón Atrás: la URL vuelve a la búsqueda anterior.
    await router.navigateByUrl('/estudiantes?ciudad=Tunja');
    await stable();
    expect(el.querySelector<HTMLInputElement>('#f-ciudad')!.value).toBe('Tunja');
    expect((await flushList())['ciudad']).toBe('Tunja');

    // Y escribir de nuevo el mismo valor anterior se vuelve a aplicar.
    type('#f-ciudad', 'Duitama');
    await wait(DEBOUNCE);
    await stable();
    expect(router.url).toBe('/estudiantes?ciudad=Duitama');
    await flushList();
  });

  it('"Limpiar filtros" quita los filtros de la URL y conserva el orden', async () => {
    const { el, flushList, stable, router } = await setup('/estudiantes?search=x&sortBy=nombre&sortDirection=asc');
    await flushList();

    el.querySelector<HTMLButtonElement>('.filters button')!.click();
    await wait(DEBOUNCE);
    await stable();
    expect(router.url).toBe('/estudiantes?sortBy=nombre&sortDirection=asc');
    expect(await flushList()).toEqual({ pageNumber: '1', pageSize: '20', sortBy: 'nombre', sortDirection: 'asc' });
  });

  it('ordena desde la cabecera y pagina con "Siguiente"', async () => {
    const { el, flushList, stable, router } = await setup('/estudiantes');
    await flushList();

    el.querySelector<HTMLButtonElement>('thead th:nth-child(3) button')!.click();
    await stable();
    expect(router.url).toBe('/estudiantes?sortBy=apellido&sortDirection=asc');
    await flushList();

    const [, siguiente] = el.querySelectorAll<HTMLButtonElement>('app-pagination button');
    siguiente.click();
    await stable();
    expect(router.url).toBe('/estudiantes?sortBy=apellido&sortDirection=asc&pageNumber=2');
    expect((await flushList(pagina(2)))['pageNumber']).toBe('2');
    expect(el.querySelector('.pagination__range')?.textContent).toContain('Mostrando 21–40 de 45');
  });

  it('muestra el error del Gateway y reintenta', async () => {
    const { el, stable } = await setup('/estudiantes');
    const backend = TestBed.inject(HttpTestingController);
    backend
      .expectOne((r) => r.url === '/api/estudiantes')
      .flush({ error: 'Servicio no disponible: http://localhost:3001' }, { status: 502, statusText: 'Bad Gateway' });
    await stable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('El módulo de Estudiantes no responde');
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await stable();
    backend.expectOne((r) => r.url === '/api/estudiantes');
  });
});

describe('EstudiantesListComponent: fotografía', () => {
  const URL_FOTO = 'https://bucket.s3.amazonaws.com/estudiantes/id-1-0/fotografia/a.jpg?X-Amz-Signature=abc';
  const conFoto = (): EstudiantesPageResponse => {
    const p = pagina(1, 2);
    p.data[0].fotografia = {
      clave_s3: 'estudiantes/id-1-0/fotografia/a.jpg',
      nombre_original: 'foto.jpg',
      tipo_mime: 'image/jpeg',
      tamano_bytes: 1024,
      url: URL_FOTO,
    };
    return p;
  };

  it('muestra la foto con la URL firmada y las iniciales cuando no hay foto', async () => {
    const { el, flushList } = await setup('/estudiantes');
    await flushList(conFoto());

    const [conImagen, sinImagen] = el.querySelectorAll('tbody tr');
    const img = conImagen.querySelector<HTMLImageElement>('img.avatar')!;
    expect(img.getAttribute('src')).toBe(URL_FOTO);
    expect(img.alt).toBe('Fotografía de Nombre 0 Apellido 0');

    expect(sinImagen.querySelector('img')).toBeNull();
    expect(sinImagen.querySelector('.avatar--vacio')?.textContent?.trim()).toBe('NA');
    expect(sinImagen.textContent).toContain('Sin fotografía');
  });

  it('si la imagen no carga (URL vencida) muestra las iniciales', async () => {
    const { el, flushList, stable } = await setup('/estudiantes');
    await flushList(conFoto());

    el.querySelector<HTMLImageElement>('tbody tr:first-child img.avatar')!.dispatchEvent(new Event('error'));
    await stable();

    const fila = el.querySelector('tbody tr:first-child')!;
    expect(fila.querySelector('img')).toBeNull();
    expect(fila.querySelector('.avatar--vacio')?.textContent?.trim()).toBe('NA');
  });
});

describe('EstudiantesListComponent: roles', () => {
  afterEach(() => cerrarSesion());

  it('ESTUDIANTE ve "Ver detalle" pero no "Nuevo estudiante" ni "Editar"', async () => {
    iniciarSesionComo('ESTUDIANTE');
    const { el, flushList } = await setup('/estudiantes');
    await flushList(pagina(1, 2));

    expect(el.textContent).not.toContain('Nuevo estudiante');
    expect(el.querySelector('a[href*="editar"]')).toBeNull();
    expect(el.querySelectorAll('.table__action a').length).toBe(2);
    expect(el.querySelector('.table__action')?.textContent).toContain('Ver detalle');
    // Tampoco ve los identificadores
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).not.toContain('ID');
    expect(el.querySelector('.table__id')).toBeNull();
  });

  it('ADMIN ve "Nuevo estudiante" y "Editar"', async () => {
    iniciarSesionComo('ADMIN');
    const { el, flushList } = await setup('/estudiantes');
    await flushList(pagina(1, 2));

    expect(el.textContent).toContain('Nuevo estudiante');
    expect(el.querySelectorAll('a[href*="editar"]').length).toBe(2);
  });

  it('ADMIN ve el _id de cada estudiante junto a la foto', async () => {
    iniciarSesionComo('ADMIN');
    const { el, flushList } = await setup('/estudiantes');
    await flushList(pagina(1, 2));

    const cabeceras = [...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(cabeceras.slice(0, 2)).toEqual(['Foto', 'ID']);
    expect([...el.querySelectorAll('.table__id')].map((td) => td.textContent?.trim())).toEqual(['id-1-0', 'id-1-1']);
  });

  it('con ADMIN el orden por Apellido sigue funcionando pese a la columna extra', async () => {
    iniciarSesionComo('ADMIN');
    const { el, flushList, stable, router } = await setup('/estudiantes');
    await flushList();

    el.querySelector<HTMLButtonElement>('thead th:nth-child(4) button')!.click();
    await stable();
    expect(router.url).toBe('/estudiantes?sortBy=apellido&sortDirection=asc');
  });
});
