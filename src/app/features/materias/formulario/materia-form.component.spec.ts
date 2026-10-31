import { formRoutes, renderRoute } from '../../../../testing/route-harness';
import { Materia } from '../../../models';
import { MateriaFormComponent } from './materia-form.component';

const MATERIA: Materia = {
  id: 5,
  nombre: 'Sistemas Distribuidos',
  descripcion: 'Estudio de sistemas de cómputo distribuido',
  creditos: 4,
  programa: 'Ingeniería de Sistemas y Computación',
};

async function render(url: string) {
  const h = await renderRoute(formRoutes('materias', MateriaFormComponent), url);
  await h.flush(h.backend.expectOne('/api/estudiantes/programas'), []);
  return h;
}

describe('MateriaFormComponent', () => {
  it('modo creación: envía creditos como número y la descripción vacía como null', async () => {
    const h = await render('/materias/nuevo');
    h.type('#nombre', ' Bases de Datos ');
    h.type('#creditos', '3');
    h.type('#programa', 'Ingeniería de Sistemas y Computación');
    await h.submit();

    const req = h.backend.expectOne('/api/materias');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Bases de Datos',
      descripcion: null,
      creditos: 3,
      programa: 'Ingeniería de Sistemas y Computación',
    });
    await h.flush(req, { ...MATERIA, id: 6 }, { status: 201, statusText: 'Created' });
    expect(h.router.url).toBe('/materias');
    expect(h.notifications.toasts()[0].title).toBe('Se creó la materia Bases de Datos.');
  });

  it('créditos debe ser un entero positivo y se respetan los límites del módulo', async () => {
    const h = await render('/materias/nuevo');
    h.type('#nombre', 'x'.repeat(151));
    h.type('#programa', 'Medicina');

    for (const valor of ['0', '-2', '3.5', 'tres']) {
      h.type('#creditos', valor);
      await h.submit();
      expect(h.fieldError('creditos')).toBe('Escribe un número entero positivo, por ejemplo 3.');
    }
    expect(h.fieldError('nombre')).toBe('Máximo 150 caracteres.');
    h.backend.expectNone('/api/materias');
  });

  it('modo edición: carga la materia y envía PUT a /api/materias/{id}', async () => {
    const h = await render('/materias/5/editar');
    await h.flush(h.backend.expectOne('/api/materias/5'), MATERIA);

    expect(h.el.querySelector<HTMLInputElement>('#creditos')!.value).toBe('4');
    expect(h.el.querySelector<HTMLTextAreaElement>('#descripcion')!.value).toBe(MATERIA.descripcion);

    h.type('#creditos', '5');
    await h.submit();
    const req = h.backend.expectOne('/api/materias/5');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nombre: 'Sistemas Distribuidos',
      descripcion: 'Estudio de sistemas de cómputo distribuido',
      creditos: 5,
      programa: 'Ingeniería de Sistemas y Computación',
    });
  });

  it('un ID no numérico se trata como no encontrado sin llamar al API', async () => {
    const h = await render('/materias/abc/editar');
    h.backend.expectNone('/api/materias/abc');
    expect(h.el.querySelector('[role="alert"]')?.textContent).toContain('No hay una materia con el ID abc.');
  });

  it('muestra el detalle de validación que devuelve Materias en un 400', async () => {
    const h = await render('/materias/nuevo');
    h.type('#nombre', 'Ética');
    h.type('#creditos', '2');
    h.type('#programa', 'Medicina');
    await h.submit();

    await h.flush(
      h.backend.expectOne('/api/materias'),
      { status: 400, error: 'BAD_REQUEST', message: 'creditos: Los créditos deben ser un número positivo', path: '/api/materias' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(h.el.querySelector('.form-error')?.textContent).toContain('creditos: Los créditos deben ser un número positivo');
  });
});
