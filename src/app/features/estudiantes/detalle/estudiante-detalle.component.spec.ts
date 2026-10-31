import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { APP_CONFIG, AppConfig } from '../../../core/config/app-config';
import { EstudianteDetalle } from '../../../models';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { NotificationService } from '../../../core/feedback/notification.service';
import { EstudianteDetalleComponent } from './estudiante-detalle.component';

const ID = '6501f8a2c9d4e5f6a7b8c9d0';
const URL = `/api/estudiantes/${ID}/detalle`;

/** Ejemplo de respuesta documentado en el README del API Gateway. */
const DETALLE_README: EstudianteDetalle = {
  estudiante: {
    _id: ID,
    nombre: 'Laura',
    apellido: 'Gómez',
    correo: 'laura.gomez@ejemplo.com',
    fecha_nacimiento: '2003-05-20T00:00:00.000Z',
    programa: { _id: '60d5ec49f1b2c8b1f8e4e1a1', nombre: 'Ingeniería de Sistemas y Computación', codigo: 'ISC-01', facultad: 'Facultad de Ingeniería' },
    contacto: { telefono: '3001234567', direccion: 'Calle 10 #5-30', ciudad: 'Sogamoso' },
  },
  inscripciones: [
    {
      _id: '6501f8a2c9d4e5f6a7b8c9d1',
      estudianteId: ID,
      cursoId: '1',
      periodo: '2026-2',
      estado: 'activa',
      curso: {
        id: 1,
        materiaId: 1,
        materiaNombre: 'Sistemas Distribuidos',
        docenteId: 1,
        horario: 'Lunes y Miércoles 14:00-16:00',
        periodo: '2026-2',
        cupo: 30,
        aula: 'Laboratorio 204',
        modalidad: 'PRESENCIAL',
        estado: 'ACTIVO',
        docente: {
          id: 1,
          nombres: 'Carlos Andrés',
          apellidos: 'Ramírez López',
          correoInstitucional: 'carlos.ramirez@uptc.edu.co',
          especialidad: 'Sistemas Distribuidos y Cloud Computing',
          activo: true,
        },
      },
      notas: [
        { tipo: 'Parcial 1', valor: 4.2 },
        { tipo: 'Quiz 1', valor: 4.5 },
      ],
    },
  ],
};

const CONFIG: AppConfig = {
  production: false,
  apiBaseUrl: '/api',
  auth: { attachToken: false },
  latency: { enabled: false, delayMs: 0 },
};

async function render() {
  TestBed.configureTestingModule({
    imports: [EstudianteDetalleComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: APP_CONFIG, useValue: CONFIG },
    ],
  });
  const fixture = TestBed.createComponent(EstudianteDetalleComponent);
  fixture.componentRef.setInput('id', ID);
  await fixture.whenStable();
  return { fixture, backend: TestBed.inject(HttpTestingController), el: fixture.nativeElement as HTMLElement };
}

describe('EstudianteDetalleComponent', () => {
  it('muestra el indicador de carga y luego el perfil con sus inscripciones', async () => {
    const { fixture, backend, el } = await render();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando');

    backend.expectOne(URL).flush(DETALLE_README);
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Laura Gómez');
    expect(el.textContent).toContain('laura.gomez@ejemplo.com');
    expect(el.textContent).toContain('Ingeniería de Sistemas y Computación');
    expect(el.textContent).toContain('Calle 10 #5-30, Sogamoso');

    const cards = el.querySelectorAll('.enrollment');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Sistemas Distribuidos');
    expect(cards[0].textContent).toContain('Lunes y Miércoles 14:00-16:00');
    expect(cards[0].textContent).toContain('Carlos Andrés Ramírez López');
    expect(cards[0].querySelectorAll('.grade').length).toBe(2);
    expect(cards[0].textContent).toContain('4.2');
    backend.verify();
  });

  it('muestra un mensaje claro ante un 404', async () => {
    const { fixture, backend, el } = await render();
    backend.expectOne(URL).flush({ error: 'Estudiante no encontrado' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(`No hay un estudiante con el ID ${ID}`);
  });

  it('nombra el módulo caído ante un 502 y permite reintentar', async () => {
    const { fixture, backend, el } = await render();
    backend
      .expectOne(URL)
      .flush({ error: 'Servicio no disponible: http://localhost:3002' }, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('El módulo de Materias no responde');

    el.querySelector<HTMLButtonElement>('.button')?.click();
    await fixture.whenStable();
    backend.expectOne(URL).flush(DETALLE_README);
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('Laura Gómez');
  });
});

describe('EstudianteDetalleComponent: eliminar', () => {
  it('confirma avisando que las inscripciones se conservan, elimina y vuelve al listado', async () => {
    const { fixture, backend, el } = await render();
    backend.expectOne(URL).flush(DETALLE_README);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const confirm = TestBed.inject(ConfirmService);

    el.querySelector<HTMLButtonElement>('.profile__delete')!.click();
    expect(confirm.pending()?.title).toBe('¿Eliminar a Laura Gómez?');
    expect(confirm.pending()?.message).toContain('Sus inscripciones no se eliminan');
    confirm.settle(true);
    await fixture.whenStable();

    const req = backend.expectOne(`/api/estudiantes/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/estudiantes');
    expect(TestBed.inject(NotificationService).toasts()[0].title).toBe('Se eliminó a Laura Gómez.');
  });
});
