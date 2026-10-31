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

  it('en edición, el estado es obligatorio', async () => {
    const h = await render(`/inscripciones/${INSCRIPCION._id}/editar`);
    await h.flush(h.backend.expectOne(`/api/inscripciones/${INSCRIPCION._id}`), INSCRIPCION);
    h.type('#estado', ' ');
    await h.submit();

    h.backend.expectNone(`/api/inscripciones/${INSCRIPCION._id}`);
    expect(h.fieldError('estado')).toBe('Este campo es obligatorio.');
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
});
