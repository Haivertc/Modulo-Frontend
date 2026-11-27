import { TestRequest } from '@angular/common/http/testing';

import { formRoutes, renderRoute } from '../../../../testing/route-harness';
import { InscripcionResumen } from '../../../models';
import { InscripcionFormComponent } from './inscripcion-form.component';

const INSCRIPCION: InscripcionResumen = {
  _id: '6501f8a2c9d4e5f6a7b8c9d1',
  estudianteId: '6501f8a2c9d4e5f6a7b8c9d0',
  cursoId: '1',
  periodo: '2026-2',
  estado: 'activa',
  notas: [],
};

const render = (url: string) => renderRoute(formRoutes('inscripciones', InscripcionFormComponent), url);

async function renderCreacionLlena() {
  const h = await render('/inscripciones/nuevo');
  h.type('#estudianteId', INSCRIPCION.estudianteId);
  h.type('#cursoId', '1');
  h.type('#periodo', '2026-2');
  return h;
}

const claveDe = (req: TestRequest) => req.request.headers.get('Idempotency-Key');
const CAIDO = { status: 503, statusText: 'Service Unavailable' };

describe('InscripcionFormComponent', () => {
  it('modo creación: no muestra Estado y envía solo estudianteId, cursoId y periodo', async () => {
    const h = await render('/inscripciones/nuevo');
    expect(h.el.querySelector('#estado')).toBeNull();

    h.type('#estudianteId', INSCRIPCION.estudianteId);
    h.type('#cursoId', '3');
    h.type('#periodo', '2026-1');
    await h.submit();

    const req = h.backend.expectOne('/api/inscripciones');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ estudianteId: INSCRIPCION.estudianteId, cursoId: '3', periodo: '2026-1' });
    await h.flush(req, INSCRIPCION, { status: 201, statusText: 'Created' });
    expect(h.router.url).toBe('/inscripciones');
    expect(h.notifications.toasts()[0].title).toBe('Se creó la inscripción.');
  });

  it('valida el formato del ObjectId, del curso y del periodo', async () => {
    const h = await render('/inscripciones/nuevo');
    h.type('#estudianteId', '12345');
    h.type('#cursoId', '0');
    h.type('#periodo', '2026-3');
    await h.submit();

    h.backend.expectNone('/api/inscripciones');
    expect(h.fieldError('estudianteId')).toBe('El ID de estudiante tiene 24 caracteres hexadecimales (0-9, a-f).');
    expect(h.fieldError('cursoId')).toBe('El ID de curso es un número entero positivo, por ejemplo 1.');
    expect(h.fieldError('periodo')).toBe('Usa el formato AAAA-1 o AAAA-2, por ejemplo 2026-2.');
  });

  it('modo edición: carga la inscripción y envía PUT incluyendo el estado', async () => {
    const h = await render(`/inscripciones/${INSCRIPCION._id}/editar`);
    await h.flush(h.backend.expectOne(`/api/inscripciones/${INSCRIPCION._id}`), INSCRIPCION);

    expect(h.el.querySelector<HTMLInputElement>('#estado')!.value).toBe('activa');
    h.type('#estado', 'cancelada');
    await h.submit();

    const req = h.backend.expectOne(`/api/inscripciones/${INSCRIPCION._id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      estudianteId: INSCRIPCION.estudianteId,
      cursoId: '1',
      periodo: '2026-2',
      estado: 'cancelada',
    });
    await h.flush(req, { ...INSCRIPCION, estado: 'cancelada' });
    expect(h.notifications.toasts()[0].title).toBe('Se guardaron los cambios de la inscripción.');
  });

  it('en edición, estudiante y curso quedan deshabilitados y el estado se elige entre activa y cancelada', async () => {
    const h = await render(`/inscripciones/${INSCRIPCION._id}/editar`);
    await h.flush(h.backend.expectOne(`/api/inscripciones/${INSCRIPCION._id}`), INSCRIPCION);

    expect(h.el.querySelector<HTMLInputElement>('#estudianteId')!.disabled).toBe(true);
    expect(h.el.querySelector<HTMLInputElement>('#cursoId')!.disabled).toBe(true);
    expect(h.el.querySelector<HTMLInputElement>('#periodo')!.disabled).toBe(false);
    const opciones = [...h.el.querySelectorAll<HTMLOptionElement>('#estado option')].map((o) => o.value);
    expect(opciones).toEqual(['activa', 'cancelada']);
    expect(h.el.textContent).toContain('El estudiante y el curso no se pueden cambiar');
  });

  it('en creación, estudiante y curso son editables', async () => {
    const h = await render('/inscripciones/nuevo');
    expect(h.el.querySelector<HTMLInputElement>('#estudianteId')!.disabled).toBe(false);
    expect(h.el.querySelector<HTMLInputElement>('#cursoId')!.disabled).toBe(false);
  });

  it('un 500 del módulo se muestra con el sistema de errores y no redirige', async () => {
    const h = await render('/inscripciones/nuevo');
    h.type('#estudianteId', INSCRIPCION.estudianteId);
    h.type('#cursoId', '1');
    h.type('#periodo', '2026-2');
    await h.submit();

    await h.flush(
      h.backend.expectOne('/api/inscripciones'),
      { message: 'connection refused' },
      { status: 500, statusText: 'Server Error' },
    );
    expect(h.el.querySelector('.form-error')?.textContent).toContain('El Gateway respondió con un error (500)');
    expect(h.router.url).toBe('/inscripciones/nuevo');
  });

  // ---------- Idempotencia ----------

  it('envía Idempotency-Key con un UUID al crear', async () => {
    const h = await renderCreacionLlena();
    await h.submit();

    const req = h.backend.expectOne('/api/inscripciones');
    expect(claveDe(req)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await h.flush(req, INSCRIPCION, { status: 201, statusText: 'Created' });
  });

  it('tras un 503 o un fallo de red reintenta con la misma clave', async () => {
    const h = await renderCreacionLlena();
    await h.submit();
    const primera = h.backend.expectOne('/api/inscripciones');
    const clave = claveDe(primera);
    await h.flush(primera, { message: 'Materias no responde', errorType: 'ServicioNoDisponible' }, CAIDO);
    expect(h.el.querySelector('.form-error')?.textContent).toContain(
      'Un módulo no está disponible, intenta de nuevo en unos segundos',
    );

    await h.submit();
    const segunda = h.backend.expectOne('/api/inscripciones');
    expect(claveDe(segunda)).toBe(clave);
    segunda.error(new ProgressEvent('error'));
    await h.stable();

    await h.submit();
    const tercera = h.backend.expectOne('/api/inscripciones');
    expect(claveDe(tercera)).toBe(clave);
    await h.flush(tercera, INSCRIPCION, { status: 201, statusText: 'Created' });
    expect(h.router.url).toBe('/inscripciones');
  });

  it('si el usuario cambia los datos después de un fallo, usa una clave nueva', async () => {
    const h = await renderCreacionLlena();
    await h.submit();
    const primera = h.backend.expectOne('/api/inscripciones');
    const clave = claveDe(primera);
    await h.flush(primera, { message: 'caído' }, CAIDO);

    h.type('#cursoId', '2');
    await h.submit();
    const segunda = h.backend.expectOne('/api/inscripciones');
    expect(claveDe(segunda)).not.toBe(clave);
    expect(segunda.request.body.cursoId).toBe('2');
    await h.flush(segunda, INSCRIPCION, { status: 201, statusText: 'Created' });
  });

  it('tras un error de negocio (409/422) el siguiente envío usa una clave nueva', async () => {
    const h = await renderCreacionLlena();
    await h.submit();
    const primera = h.backend.expectOne('/api/inscripciones');
    const clave = claveDe(primera);
    await h.flush(primera, { message: 'Sin cupos', errorType: 'CupoAgotado' }, { status: 409, statusText: 'Conflict' });

    await h.submit();
    const segunda = h.backend.expectOne('/api/inscripciones');
    expect(claveDe(segunda)).not.toBe(clave);
    await h.flush(segunda, INSCRIPCION, { status: 201, statusText: 'Created' });
  });

  it('doble clic o Enter repetido envía una sola petición y el botón queda deshabilitado', async () => {
    const h = await renderCreacionLlena();
    const form = h.el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    form.dispatchEvent(new Event('submit'));
    await h.stable();
    form.dispatchEvent(new Event('submit'));
    await h.stable();

    const req = h.backend.expectOne('/api/inscripciones');
    const boton = h.el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(true);
    expect(boton.textContent).toContain('Guardando…');
    await h.flush(req, INSCRIPCION, { status: 201, statusText: 'Created' });
  });

  // ---------- Mensajes por errorType ----------

  for (const [errorType, status, mensaje] of [
    ['CupoAgotado', 409, 'El curso no tiene cupos disponibles'],
    ['InscripcionDuplicada', 409, 'El estudiante ya está inscrito en este curso'],
    ['EstudianteNoExiste', 422, 'El estudiante no existe o está inactivo'],
    ['EstudianteInactivo', 422, 'El estudiante no existe o está inactivo'],
    ['CursoNoExiste', 422, 'El curso no existe o está inactivo'],
    ['CursoInactivo', 422, 'El curso no existe o está inactivo'],
  ] as const) {
    it(`${status} ${errorType}: ${mensaje}`, async () => {
      const h = await renderCreacionLlena();
      await h.submit();
      await h.flush(
        h.backend.expectOne('/api/inscripciones'),
        { message: 'texto técnico del módulo', errorType },
        { status, statusText: 'Error' },
      );
      const error = h.el.querySelector('.form-error')?.textContent;
      expect(error).toContain(mensaje);
      expect(error).not.toContain('texto técnico del módulo');
      expect(h.router.url).toBe('/inscripciones/nuevo');
    });
  }

  it('un 503 sin errorType también muestra el mensaje de módulo no disponible', async () => {
    const h = await renderCreacionLlena();
    await h.submit();
    await h.flush(h.backend.expectOne('/api/inscripciones'), null, CAIDO);
    expect(h.el.querySelector('.form-error')?.textContent).toContain(
      'Un módulo no está disponible, intenta de nuevo en unos segundos',
    );
  });
});
