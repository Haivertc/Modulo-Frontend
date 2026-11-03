import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Rol } from '../../../core/auth/auth.service';
import { ContenidoTematico, MateriasPageResponse } from '../../../models';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { NotificationService } from '../../../core/feedback/notification.service';
import { FileDownloadService } from '../../../core/files/file-download.service';
import { archivoDePrueba, cerrarSesion, elegirArchivo, iniciarSesionComo } from '../../../../testing/session';
import { MateriasListComponent } from './materias-list.component';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MB = 1024 * 1024;

/** Respuesta con la forma real de `GET /api/materias` (Spring, base 0). */
const PAGINA: MateriasPageResponse = {
  content: [
    { id: 1, nombre: 'Sistemas Distribuidos', descripcion: 'Cómputo distribuido', creditos: 4, programa: 'Ingeniería de Sistemas' },
    { id: 2, nombre: 'Bases de Datos', descripcion: 'Modelado relacional', creditos: 3, programa: 'Ingeniería de Sistemas' },
  ],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 2,
  totalPages: 1,
};

const PROGRAMAS = [
  { _id: 'p1', nombre: 'Ingeniería de Sistemas', codigo: 'ISC-01', facultad: 'Ingeniería' },
  { _id: 'p2', nombre: 'Medicina', codigo: 'MED-01', facultad: 'Salud' },
];

const archivo = (id: number, materiaId: number, nombre = `v${id}.pdf`): ContenidoTematico => ({
  id,
  materiaId,
  claveS3: `materias/${materiaId}/contenido-tematico/${id}.pdf`,
  nombreOriginal: nombre,
  tipoMime: 'application/pdf',
  tamanoBytes: 2048,
  url: `https://bucket.s3.amazonaws.com/materias/${materiaId}/${id}.pdf?X-Amz-Signature=abc`,
});

async function setup(url: string, rol: Rol = 'ADMIN') {
  iniciarSesionComo(rol);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'materias', component: MateriasListComponent }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const backend = TestBed.inject(HttpTestingController);
  backend.expectOne('/api/estudiantes/programas').flush(PROGRAMAS);
  const el = harness.fixture.nativeElement as HTMLElement;
  const stable = () => harness.fixture.whenStable();
  const flushList = async () => {
    const reqs = backend.match((r) => r.url === '/api/materias');
    const req = reqs[reqs.length - 1];
    const params = Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]));
    req.flush(PAGINA);
    await stable();
    return params;
  };
  /** Responde la consulta de estado del contenido temático de cada materia de la página. */
  const flushEstados = async (porMateria: Record<number, ContenidoTematico[]>) => {
    for (const [id, archivos] of Object.entries(porMateria)) {
      backend.expectOne(`/api/materias/${id}/contenido-tematico`).flush(archivos);
    }
    await stable();
  };
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const fila = (n: number) => el.querySelector<HTMLTableRowElement>(`tbody tr:nth-child(${n})`)!;
  const boton = (contenedor: Element, texto: string) =>
    [...contenedor.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(texto));
  return { el, stable, flushList, flushEstados, type, fila, boton, backend, router: TestBed.inject(Router) };
}

afterEach(() => cerrarSesion());

describe('MateriasListComponent', () => {
  it('traduce la página 1 de la URL a pageNumber=0 y envía los tres filtros', async () => {
    const { el, flushList } = await setup('/materias?nombre=sist&creditos=4&programa=Medicina&sortBy=creditos&sortDirection=desc');

    expect(await flushList()).toEqual({
      pageNumber: '0',
      pageSize: '20',
      sortBy: 'creditos',
      sortDirection: 'desc',
      nombre: 'sist',
      creditos: '4',
      programa: 'Medicina',
    });
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Página 1 de 1');
    expect(el.querySelector<HTMLInputElement>('#f-creditos')!.value).toBe('4');
    expect(el.querySelector<HTMLSelectElement>('#f-programa')!.value).toBe('Medicina');
  });

  it('no aplica créditos no numéricos y muestra el motivo junto al campo', async () => {
    const { el, flushList, type, stable, backend, router } = await setup('/materias');
    await flushList();

    type('#f-creditos', 'tres');
    await wait(400);
    await stable();
    expect(el.querySelector('#f-creditos-error')?.textContent).toContain('Escribe un número entero');
    expect(router.url).toBe('/materias');
    backend.expectNone((r) => r.url === '/api/materias');

    type('#f-creditos', '3');
    await wait(400);
    await stable();
    expect(router.url).toBe('/materias?creditos=3');
    expect((await flushList())['creditos']).toBe('3');
  });

  it('ignora créditos inválidos que lleguen por URL en lugar de provocar un 400', async () => {
    const { flushList } = await setup('/materias?creditos=abc');
    expect((await flushList())['creditos']).toBeUndefined();
  });

  it('ordena por créditos desde la cabecera', async () => {
    const { el, flushList, stable, router } = await setup('/materias');
    await flushList();

    // Con ADMIN la primera columna es el ID: Créditos es la tercera
    el.querySelector<HTMLButtonElement>('thead th:nth-child(3) button')!.click();
    await stable();
    expect(router.url).toBe('/materias?sortBy=creditos&sortDirection=asc');
    expect(await flushList()).toEqual({ pageNumber: '0', pageSize: '20', sortBy: 'creditos', sortDirection: 'asc' });
  });
});

describe('MateriasListComponent: filtro de programa', () => {
  it('es un selector con los programas del módulo Estudiantes y filtra por el nombre exacto', async () => {
    const { el, flushList, type, stable, router } = await setup('/materias');
    await flushList();

    const opciones = [...el.querySelectorAll<HTMLOptionElement>('#f-programa option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Todos', 'Ingeniería de Sistemas', 'Medicina']);

    type('#f-programa', 'Medicina');
    await wait(400);
    await stable();
    expect(router.url).toBe('/materias?programa=Medicina');
    expect((await flushList())['programa']).toBe('Medicina');
  });

  it('conserva como opción un programa de la URL que no está en el catálogo', async () => {
    const { el, flushList } = await setup('/materias?programa=Programa%20antiguo');
    await flushList();
    expect(el.querySelector<HTMLSelectElement>('#f-programa')!.value).toBe('Programa antiguo');
  });
});

describe('MateriasListComponent: roles', () => {
  it('ESTUDIANTE no ve Nueva, Editar ni Eliminar (ni la columna de acciones)', async () => {
    const { el, flushList } = await setup('/materias', 'ESTUDIANTE');
    await flushList();

    expect(el.textContent).not.toContain('Nueva materia');
    expect(el.querySelector('a[href*="editar"]')).toBeNull();
    expect(el.querySelector('.link-button--danger')).toBeNull();
    expect(el.querySelector('.table__action')).toBeNull();
    expect(el.querySelectorAll('thead th').length).toBe(5);
  });

  it('ESTUDIANTE no ve la columna de ID', async () => {
    const { el, flushList } = await setup('/materias', 'ESTUDIANTE');
    await flushList();

    const cabeceras = [...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(cabeceras).not.toContain('ID');
    expect(el.querySelector('.table__id')).toBeNull();
  });

  it('ADMIN ve el ID de cada materia en la primera columna', async () => {
    const { el, flushList } = await setup('/materias', 'ADMIN');
    await flushList();

    expect(el.querySelector('thead th:first-child')?.textContent?.trim()).toBe('ID');
    expect([...el.querySelectorAll('.table__id')].map((td) => td.textContent?.trim())).toEqual(['1', '2']);
  });

  it('ADMIN ve Nueva, Editar y Eliminar', async () => {
    const { el, flushList } = await setup('/materias', 'ADMIN');
    await flushList();

    expect(el.textContent).toContain('Nueva materia');
    expect(el.querySelectorAll('a[href*="editar"]').length).toBe(2);
    expect(el.querySelectorAll('.link-button--danger').length).toBe(2);
  });
});

describe('MateriasListComponent: estado del contenido temático', () => {
  it('consulta en segundo plano el contenido de cada materia de la página', async () => {
    const { fila, flushList, flushEstados } = await setup('/materias');
    await flushList();
    expect(fila(1).textContent).toContain('Consultando…');
    await flushEstados({ 1: [archivo(10, 1)], 2: [] });
    expect(fila(1).textContent).not.toContain('Consultando…');
  });

  it('ADMIN: con PDF ve Descargar y Reemplazar; sin PDF ve Subir', async () => {
    const { fila, boton, flushList, flushEstados } = await setup('/materias', 'ADMIN');
    await flushList();
    await flushEstados({ 1: [archivo(10, 1)], 2: [] });

    expect(boton(fila(1), 'Descargar PDF')).toBeDefined();
    expect(boton(fila(1), 'Reemplazar PDF')).toBeDefined();
    expect(boton(fila(1), 'Subir PDF')).toBeUndefined();
    expect(boton(fila(2), 'Subir PDF')).toBeDefined();
    expect(boton(fila(2), 'Descargar PDF')).toBeUndefined();
  });

  it('ESTUDIANTE: con PDF ve solo Descargar; sin PDF ve "Sin contenido" sin botones', async () => {
    const { fila, boton, flushList, flushEstados } = await setup('/materias', 'ESTUDIANTE');
    await flushList();
    await flushEstados({ 1: [archivo(10, 1)], 2: [] });

    expect(boton(fila(1), 'Descargar PDF')).toBeDefined();
    expect(boton(fila(1), 'Reemplazar PDF')).toBeUndefined();
    const sinPdf = fila(2).querySelector('[data-label="Contenido temático"]')!;
    expect(sinPdf.textContent?.trim()).toBe('Sin contenido');
    expect(sinPdf.querySelector('button')).toBeNull();
  });

  it('si la consulta falla lo indica en la fila y permite reintentar', async () => {
    const { fila, boton, flushList, stable, backend } = await setup('/materias');
    await flushList();
    backend
      .expectOne('/api/materias/1/contenido-tematico')
      .flush({ error: 'Servicio no disponible: http://localhost:3002' }, { status: 502, statusText: 'Bad Gateway' });
    backend.expectOne('/api/materias/2/contenido-tematico').flush([]);
    await stable();

    expect(fila(1).textContent).toContain('No se pudo consultar.');
    boton(fila(1), 'Reintentar')!.click();
    await stable();
    backend.expectOne('/api/materias/1/contenido-tematico').flush([archivo(10, 1)]);
    await stable();
    expect(boton(fila(1), 'Descargar PDF')).toBeDefined();
  });
});

describe('MateriasListComponent: descargar PDF', () => {
  it('pide una URL firmada vigente al hacer clic y descarga el PDF más reciente', async () => {
    const { fila, boton, flushList, flushEstados, stable, backend } = await setup('/materias', 'ESTUDIANTE');
    await flushList();
    await flushEstados({ 1: [archivo(10, 1)], 2: [] });
    const download = vi.spyOn(TestBed.inject(FileDownloadService), 'download').mockImplementation(() => {});

    const descargar = boton(fila(1), 'Descargar PDF')!;
    descargar.click();
    await stable();
    expect(descargar.disabled).toBe(true);
    expect(descargar.textContent).toContain('Preparando…');

    backend.expectOne('/api/materias/1/contenido-tematico').flush([archivo(10, 1), archivo(11, 1)]);
    await stable();
    expect(download).toHaveBeenCalledWith(archivo(11, 1).url);
    expect(descargar.disabled).toBe(false);
  });

  it('si el módulo falla al descargar, lo explica con un toast de error', async () => {
    const { fila, boton, flushList, flushEstados, stable, backend } = await setup('/materias');
    await flushList();
    await flushEstados({ 1: [archivo(10, 1)], 2: [] });

    boton(fila(1), 'Descargar PDF')!.click();
    backend
      .expectOne('/api/materias/1/contenido-tematico')
      .flush({ error: 'Servicio no disponible: http://localhost:3002' }, { status: 502, statusText: 'Bad Gateway' });
    await stable();

    expect(TestBed.inject(NotificationService).toasts()[0]).toMatchObject({
      kind: 'error',
      title: 'El módulo de Materias no responde',
    });
  });
});

describe('MateriasListComponent: subir PDF (ADMIN)', () => {
  async function abrirSubida(texto: 'Subir PDF' | 'Reemplazar PDF') {
    const h = await setup('/materias', 'ADMIN');
    await h.flushList();
    await h.flushEstados({ 1: [archivo(10, 1)], 2: [] });
    h.boton(h.fila(texto === 'Subir PDF' ? 2 : 1), texto)!.click();
    await h.stable();
    const dialog = h.el.querySelector<HTMLDialogElement>('dialog.upload')!;
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    const enviar = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    return { ...h, dialog, input, enviar };
  }

  it('abre el diálogo, valida el PDF y lo envía como multipart en el campo "archivo"', async () => {
    const { dialog, input, enviar, stable, backend, fila, boton } = await abrirSubida('Subir PDF');
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Subir contenido temático: Bases de Datos');
    expect(input.accept).toContain('application/pdf');
    expect(enviar.disabled).toBe(true);

    const pdf = archivoDePrueba('programa.pdf', 'application/pdf', 4096, '%PDF-1.7');
    elegirArchivo(input, pdf);
    await stable();
    expect(enviar.disabled).toBe(false);
    enviar.click();
    await stable();

    const req = backend.expectOne('/api/materias/2/contenido-tematico');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('archivo')).toMatchObject({ name: 'programa.pdf', type: 'application/pdf', size: pdf.size });
    expect(enviar.textContent).toContain('Subiendo…');
    req.flush(archivo(20, 2, 'programa.pdf'), { status: 201, statusText: 'Created' });
    await stable();

    expect(dialog.open).toBe(false);
    expect(boton(fila(2), 'Descargar PDF')).toBeDefined();
    expect(TestBed.inject(NotificationService).toasts()[0].title).toBe('Se subió el contenido temático de Bases de Datos.');
  });

  it('rechaza en el navegador archivos que no son PDF o que pasan de 10 MB, sin enviarlos', async () => {
    const { dialog, input, enviar, stable, backend } = await abrirSubida('Reemplazar PDF');
    expect(dialog.querySelector('h2')?.textContent).toBe('Reemplazar contenido temático: Sistemas Distribuidos');

    elegirArchivo(input, archivoDePrueba('programa.docx', 'application/msword', 100));
    await stable();
    expect(dialog.querySelector('.field__error')?.textContent).toContain('Solo se aceptan archivos PDF');
    expect(enviar.disabled).toBe(true);

    elegirArchivo(input, archivoDePrueba('grande.pdf', 'application/pdf', 10 * MB + 1, '%PDF-'));
    await stable();
    expect(dialog.querySelector('.field__error')?.textContent).toContain('el máximo permitido es 10 MB');
    expect(enviar.disabled).toBe(true);
    backend.expectNone('/api/materias/1/contenido-tematico');
  });

  it('si el módulo rechaza o falla la subida, muestra el error dentro del diálogo y lo deja abierto', async () => {
    const { dialog, input, enviar, stable, backend } = await abrirSubida('Subir PDF');
    elegirArchivo(input, archivoDePrueba('programa.pdf', 'application/pdf', 100, '%PDF-'));
    await stable();
    enviar.click();
    await stable();

    backend.expectOne('/api/materias/2/contenido-tematico').flush(null, { status: 0, statusText: 'Unknown Error' });
    await stable();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('No hay conexión con el API Gateway');
    expect(enviar.disabled).toBe(false);
  });
});

describe('MateriasListComponent: eliminar', () => {
  it('pide confirmación; al cancelar no envía DELETE', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();
    const confirm = TestBed.inject(ConfirmService);

    el.querySelector<HTMLButtonElement>('tbody tr:first-child .link-button--danger')!.click();
    expect(confirm.pending()?.title).toBe('¿Eliminar la materia Sistemas Distribuidos?');
    expect(confirm.pending()?.confirmLabel).toBe('Eliminar materia');

    confirm.settle(false);
    await stable();
    backend.expectNone((r) => r.method === 'DELETE');
  });

  it('al confirmar envía DELETE, notifica y recarga el listado', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();
    const confirm = TestBed.inject(ConfirmService);

    el.querySelector<HTMLButtonElement>('tbody tr:first-child .link-button--danger')!.click();
    confirm.settle(true);
    await stable();

    const req = backend.expectOne((r) => r.url === '/api/materias/1' && r.method === 'DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await stable();

    expect(TestBed.inject(NotificationService).toasts()[0].title).toBe('Se eliminó la materia Sistemas Distribuidos.');
    backend.expectOne((r) => r.url === '/api/materias' && r.method === 'GET');
  });

  it('si el DELETE falla, lo explica con un toast de error', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();

    el.querySelector<HTMLButtonElement>('tbody tr:first-child .link-button--danger')!.click();
    TestBed.inject(ConfirmService).settle(true);
    await stable();
    backend
      .expectOne((r) => r.url === '/api/materias/1' && r.method === 'DELETE')
      .flush({ error: 'Servicio no disponible: http://localhost:3002' }, { status: 502, statusText: 'Bad Gateway' });
    await stable();

    expect(TestBed.inject(NotificationService).toasts()[0]).toMatchObject({
      kind: 'error',
      title: 'El módulo de Materias no responde',
    });
  });
});
