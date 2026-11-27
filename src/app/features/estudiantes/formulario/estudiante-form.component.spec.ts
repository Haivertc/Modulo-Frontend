import { RouteHarness, formRoutes, renderRoute } from '../../../../testing/route-harness';
import { Estudiante } from '../../../models';
import { EstudianteFormComponent } from './estudiante-form.component';

const PROGRAMAS = [
  { _id: '60d5ec49f1b2c8b1f8e4e1a1', nombre: 'Ingeniería de Sistemas y Computación', codigo: 'ISC-01', facultad: 'Ingeniería' },
  { _id: '60d5ec49f1b2c8b1f8e4e1a2', nombre: 'Medicina', codigo: 'MED-01', facultad: 'Salud' },
];

/** Respuesta de `GET /api/estudiantes/:id` (programa con populate). */
const LAURA: Estudiante = {
  _id: '6501f8a2c9d4e5f6a7b8c9d0',
  nombre: 'Laura',
  apellido: 'Gómez',
  correo: 'laura.gomez@ejemplo.com',
  fecha_nacimiento: '2003-05-20T00:00:00.000Z',
  programa: PROGRAMAS[0],
  contacto: { telefono: '3001234567', direccion: 'Calle 10 #5-30', ciudad: 'Sogamoso' },
  estado: 'ACTIVO',
};

async function render(url: string) {
  const h = await renderRoute(formRoutes('estudiantes', EstudianteFormComponent), url);
  await h.flush(h.backend.expectOne('/api/estudiantes/programas'), PROGRAMAS);
  return h;
}

function fillValid(h: RouteHarness) {
  h.type('#nombre', '  Andrés ');
  h.type('#apellido', 'Rojas');
  h.type('#correo', 'Andres.Rojas@Ejemplo.com');
  h.type('#fecha_nacimiento', '2004-02-29');
  h.type('#programa', PROGRAMAS[1]._id);
  h.type('#telefono', '+573001112233');
  h.type('#ciudad', 'Tunja');
  h.type('#direccion', 'Carrera 9 #20-15');
}

describe('EstudianteFormComponent', () => {
  it('modo creación: arranca vacío y envía POST con el payload exacto del módulo', async () => {
    const h = await render('/estudiantes/nuevo');
    expect(h.el.querySelector('h1')?.textContent).toContain('Nuevo estudiante');
    expect(h.el.querySelector<HTMLInputElement>('#nombre')!.value).toBe('');

    fillValid(h);
    await h.submit();

    const req = h.backend.expectOne('/api/estudiantes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Andrés',
      apellido: 'Rojas',
      correo: 'andres.rojas@ejemplo.com',
      fecha_nacimiento: '2004-02-29',
      programa: PROGRAMAS[1]._id,
      contacto: { telefono: '+573001112233', direccion: 'Carrera 9 #20-15', ciudad: 'Tunja' },
    });
    expect(h.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent).toContain('Guardando');

    await h.flush(req, { ...LAURA, _id: 'nuevo' }, { status: 201, statusText: 'Created' });
    expect(h.router.url).toBe('/estudiantes');
    expect(h.notifications.toasts()[0]).toMatchObject({ kind: 'success', title: 'Se creó el estudiante Andrés Rojas.' });
  });

  it('no envía nada si hay errores, los muestra por campo y enfoca el primero', async () => {
    const h = await render('/estudiantes/nuevo');
    h.type('#correo', 'laura@ejemplo');
    h.type('#fecha_nacimiento', '2999-01-01');
    h.type('#telefono', '300-123');
    await h.submit();

    h.backend.expectNone('/api/estudiantes');
    expect(h.fieldError('nombre')).toBe('Este campo es obligatorio.');
    expect(h.fieldError('correo')).toBe('Escribe un correo válido, por ejemplo nombre@dominio.com.');
    expect(h.fieldError('fecha_nacimiento')).toBe('La fecha de nacimiento no puede ser posterior a hoy.');
    expect(h.fieldError('programa')).toBe('Elige un programa.');
    expect(h.fieldError('telefono')).toBe('Escribe solo dígitos (7 a 15), con + opcional al inicio.');
    expect(h.el.querySelector('#nombre')!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('nombre');
  });

  it('rechaza textos con solo espacios', async () => {
    const h = await render('/estudiantes/nuevo');
    fillValid(h);
    h.type('#ciudad', '   ');
    await h.submit();

    h.backend.expectNone('/api/estudiantes');
    expect(h.fieldError('ciudad')).toBe('Este campo es obligatorio.');
  });

  it('modo edición: carga el estudiante, rellena el formulario y envía PUT', async () => {
    const h = await render(`/estudiantes/${LAURA._id}/editar`);
    await h.flush(h.backend.expectOne(`/api/estudiantes/${LAURA._id}`), LAURA);

    expect(h.el.querySelector('h1')?.textContent).toContain('Editar estudiante');
    expect(h.el.querySelector<HTMLInputElement>('#nombre')!.value).toBe('Laura');
    expect(h.el.querySelector<HTMLInputElement>('#fecha_nacimiento')!.value).toBe('2003-05-20');
    expect(h.el.querySelector<HTMLSelectElement>('#programa')!.value).toBe(PROGRAMAS[0]._id);
    expect(h.el.querySelector<HTMLInputElement>('#ciudad')!.value).toBe('Sogamoso');

    h.type('#ciudad', 'Duitama');
    await h.submit();

    const req = h.backend.expectOne(`/api/estudiantes/${LAURA._id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nombre: 'Laura',
      apellido: 'Gómez',
      correo: 'laura.gomez@ejemplo.com',
      fecha_nacimiento: '2003-05-20',
      programa: PROGRAMAS[0]._id,
      contacto: { telefono: '3001234567', direccion: 'Calle 10 #5-30', ciudad: 'Duitama' },
    });
    await h.flush(req, LAURA);
    expect(h.router.url).toBe('/estudiantes');
    expect(h.notifications.toasts()[0].title).toBe('Se guardaron los cambios de Laura Gómez.');
  });

  it('un 400 por correo duplicado se explica en el formulario y permite corregir', async () => {
    const h = await render('/estudiantes/nuevo');
    fillValid(h);
    await h.submit();

    await h.flush(
      h.backend.expectOne('/api/estudiantes'),
      { mensaje: 'Error al crear estudiante', error: { code: 11000, keyValue: { correo: 'andres.rojas@ejemplo.com' } } },
      { status: 400, statusText: 'Bad Request' },
    );

    const alert = h.el.querySelector('.form-error [role="alert"]');
    expect(alert?.textContent).toContain('El sistema no aceptó los datos');
    expect(alert?.textContent).toContain('Ya existe un registro con ese valor único');
    expect(alert?.querySelector('button')).toBeNull();
    expect(h.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(h.router.url).toBe('/estudiantes/nuevo');
  });

  it('si el estudiante a editar no existe, muestra el error de carga', async () => {
    const h = await render('/estudiantes/noexiste/editar');
    await h.flush(
      h.backend.expectOne('/api/estudiantes/noexiste'),
      { mensaje: 'Estudiante no encontrado' },
      { status: 404, statusText: 'Not Found' },
    );
    expect(h.el.querySelector('[role="alert"]')?.textContent).toContain('No hay un estudiante con el ID noexiste.');
    expect(h.el.querySelector('form')).toBeNull();
  });
});
