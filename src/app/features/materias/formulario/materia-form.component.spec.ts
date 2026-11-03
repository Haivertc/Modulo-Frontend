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

/** Catálogo de `GET /api/estudiantes/programas` (las opciones del selector). */
const PROGRAMAS = [
  { _id: 'p1', nombre: 'Ingeniería de Sistemas y Computación', codigo: 'ISC-01', facultad: 'Ingeniería' },
  { _id: 'p2', nombre: 'Medicina', codigo: 'MED-01', facultad: 'Salud' },
];

async function render(url: string) {
  const h = await renderRoute(formRoutes('materias', MateriaFormComponent), url);
  await h.flush(h.backend.expectOne('/api/estudiantes/programas'), PROGRAMAS);
  return h;
}

const opciones = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLOptionElement>('#programa option')].map((o) => o.textContent?.trim());

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

  it('el programa es un selector con los programas del catálogo y es obligatorio', async () => {
    const h = await render('/materias/nuevo');
    expect(h.el.querySelector('#programa')?.tagName).toBe('SELECT');
    expect(opciones(h.el)).toEqual(['Selecciona un programa', 'Ingeniería de Sistemas y Computación', 'Medicina']);

    h.type('#nombre', 'Ética');
    h.type('#creditos', '2');
    await h.submit();
    expect(h.fieldError('programa')).toBe('Selecciona un programa.');
    h.backend.expectNone('/api/materias');
  });

  it('al editar conserva y marca un programa antiguo que no está en el catálogo', async () => {
    const h = await render('/materias/5/editar');
    await h.flush(h.backend.expectOne('/api/materias/5'), { ...MATERIA, programa: 'Ingeniería Electrónica' });

    expect(h.el.querySelector<HTMLSelectElement>('#programa')!.value).toBe('Ingeniería Electrónica');
    expect(opciones(h.el)).toContain('Ingeniería Electrónica (valor actual, no está en el catálogo)');
  });

  it('si no cargan los programas lo explica y permite reintentar', async () => {
    const h = await renderRoute(formRoutes('materias', MateriaFormComponent), '/materias/nuevo');
    await h.flush(h.backend.expectOne('/api/estudiantes/programas'), null, { status: 502, statusText: 'Bad Gateway' });

    const aviso = h.el.querySelector('#programa-carga')!;
    expect(aviso.textContent).toContain('No se pudieron cargar los programas');
    aviso.querySelector<HTMLButtonElement>('button')!.click();
    await h.stable();
    await h.flush(h.backend.expectOne('/api/estudiantes/programas'), PROGRAMAS);
    expect(h.el.querySelector('#programa-carga')).toBeNull();
    expect(opciones(h.el)).toContain('Medicina');
  });
});
