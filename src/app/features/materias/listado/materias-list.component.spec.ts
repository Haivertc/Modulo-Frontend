import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { MateriasPageResponse } from '../../../models';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { NotificationService } from '../../../core/feedback/notification.service';
import { FileDownloadService } from '../../../core/files/file-download.service';
import { MateriasListComponent } from './materias-list.component';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function setup(url: string) {
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
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { el, stable, flushList, type, backend, router: TestBed.inject(Router) };
}

describe('MateriasListComponent', () => {
  it('traduce la página 1 de la URL a pageNumber=0 y envía los tres filtros', async () => {
    const { el, flushList } = await setup('/materias?nombre=sist&creditos=4&programa=ingenier%C3%ADa&sortBy=creditos&sortDirection=desc');

    expect(await flushList()).toEqual({
      pageNumber: '0',
      pageSize: '20',
      sortBy: 'creditos',
      sortDirection: 'desc',
      nombre: 'sist',
      creditos: '4',
      programa: 'ingeniería',
    });
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Página 1 de 1');
    expect(el.querySelector<HTMLInputElement>('#f-creditos')!.value).toBe('4');
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

    el.querySelector<HTMLButtonElement>('thead th:nth-child(2) button')!.click();
    await stable();
    expect(router.url).toBe('/materias?sortBy=creditos&sortDirection=asc');
    expect(await flushList()).toEqual({ pageNumber: '0', pageSize: '20', sortBy: 'creditos', sortDirection: 'asc' });
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

    const req = backend.expectOne('/api/materias/1');
    expect(req.request.method).toBe('DELETE');
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
      .expectOne('/api/materias/1')
      .flush({ error: 'Servicio no disponible: http://localhost:3002' }, { status: 502, statusText: 'Bad Gateway' });
    await stable();

    expect(TestBed.inject(NotificationService).toasts()[0]).toMatchObject({
      kind: 'error',
      title: 'El módulo de Materias no responde',
    });
  });
});

describe('MateriasListComponent: contenido temático', () => {
  const archivo = (id: number, nombre: string) => ({
    id,
    materiaId: 1,
    claveS3: `materias/1/contenido-tematico/${id}.pdf`,
    nombreOriginal: nombre,
    tipoMime: 'application/pdf',
    tamanoBytes: 2048,
    url: `https://bucket.s3.amazonaws.com/materias/1/${id}.pdf?X-Amz-Signature=abc`,
  });
  const botonDescarga = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find((b) =>
      b.textContent?.includes('Descargar PDF'),
    )!;

  it('pide el contenido al hacer clic y descarga el PDF más reciente con su URL firmada', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();
    const download = vi.spyOn(TestBed.inject(FileDownloadService), 'download').mockImplementation(() => {});
    backend.expectNone('/api/materias/1/contenido-tematico');

    const boton = botonDescarga(el);
    boton.click();
    await stable();
    expect(boton.disabled).toBe(true);
    expect(boton.textContent).toContain('Preparando…');

    backend.expectOne('/api/materias/1/contenido-tematico').flush([archivo(1, 'v1.pdf'), archivo(2, 'v2.pdf')]);
    await stable();

    expect(download).toHaveBeenCalledWith(archivo(2, 'v2.pdf').url);
    expect(boton.disabled).toBe(false);
  });

  it('si la materia no tiene PDF lo explica sin intentar descargar', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();
    const download = vi.spyOn(TestBed.inject(FileDownloadService), 'download').mockImplementation(() => {});

    botonDescarga(el).click();
    backend.expectOne('/api/materias/1/contenido-tematico').flush([]);
    await stable();

    expect(download).not.toHaveBeenCalled();
    expect(TestBed.inject(NotificationService).toasts()[0]).toMatchObject({
      kind: 'error',
      title: 'Sistemas Distribuidos no tiene contenido temático',
    });
  });

  it('si el módulo falla, lo explica con un toast de error', async () => {
    const { el, flushList, stable, backend } = await setup('/materias');
    await flushList();

    botonDescarga(el).click();
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
