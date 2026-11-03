import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { APP_CONFIG, AppConfig } from '../../../core/config/app-config';
import { EstudianteDetalle } from '../../../models';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { NotificationService } from '../../../core/feedback/notification.service';
import { Rol } from '../../../core/auth/auth.service';
import { archivoDePrueba, cerrarSesion, elegirArchivo, iniciarSesionComo } from '../../../../testing/session';
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

async function render(rol: Rol | null = null) {
  if (rol) iniciarSesionComo(rol);
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

afterEach(() => cerrarSesion());

describe('EstudianteDetalleComponent: eliminar', () => {
  it('confirma avisando que las inscripciones se conservan, elimina y vuelve al listado', async () => {
    const { fixture, backend, el } = await render('ADMIN');
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

describe('EstudianteDetalleComponent: roles y fotografía', () => {
  const URL_FOTO = 'https://bucket.s3.amazonaws.com/estudiantes/foto.jpg?X-Amz-Signature=abc';
  const CON_FOTO: EstudianteDetalle = {
    ...DETALLE_README,
    estudiante: {
      ...DETALLE_README.estudiante,
      fotografia: { clave_s3: 'estudiantes/x/foto.jpg', nombre_original: 'foto.jpg', tipo_mime: 'image/jpeg', tamano_bytes: 1024, url: URL_FOTO },
    },
  };
  const botonFoto = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('.profile__photo-button') ?? undefined;

  async function abrirDialogo(detalle = DETALLE_README) {
    const r = await render('ADMIN');
    r.backend.expectOne(URL).flush(detalle);
    await r.fixture.whenStable();
    botonFoto(r.el)!.click();
    await r.fixture.whenStable();
    const dialog = r.el.querySelector<HTMLDialogElement>('dialog.upload')!;
    return {
      ...r,
      dialog,
      input: dialog.querySelector<HTMLInputElement>('input[type="file"]')!,
      enviar: dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!,
      stable: () => r.fixture.whenStable(),
    };
  }

  it('ESTUDIANTE no ve Editar, Eliminar ni el botón de foto', async () => {
    const { fixture, backend, el } = await render('ESTUDIANTE');
    backend.expectOne(URL).flush(CON_FOTO);
    await fixture.whenStable();

    expect(el.querySelector('.profile__actions')).toBeNull();
    expect(botonFoto(el)).toBeUndefined();
    expect(el.textContent).not.toContain('Editar');
    expect(el.querySelector('.profile__delete')).toBeNull();
    // La foto sí se muestra
    expect(el.querySelector<HTMLImageElement>('img.profile__photo')?.getAttribute('src')).toBe(URL_FOTO);
  });

  it('ADMIN ve "Subir foto" si no hay foto y "Cambiar foto" si ya tiene', async () => {
    const sin = await render('ADMIN');
    sin.backend.expectOne(URL).flush(DETALLE_README);
    await sin.fixture.whenStable();
    expect(botonFoto(sin.el)?.textContent?.trim()).toBe('Subir foto');
    expect(sin.el.querySelector('.profile__photo--vacia')?.textContent?.trim()).toBe('LG');

    TestBed.resetTestingModule();
    const con = await render('ADMIN');
    con.backend.expectOne(URL).flush(CON_FOTO);
    await con.fixture.whenStable();
    expect(botonFoto(con.el)?.textContent?.trim()).toBe('Cambiar foto');
  });

  it('valida JPG/PNG y 2 MB antes de enviar; no envía archivos inválidos', async () => {
    const { input, enviar, dialog, stable, backend } = await abrirDialogo();
    expect(dialog.open).toBe(true);
    expect(input.accept).toBe('image/jpeg,.jpg,.jpeg,image/png,.png');

    elegirArchivo(input, archivoDePrueba('animada.gif', 'image/gif', 100));
    await stable();
    expect(dialog.querySelector('.field__error')?.textContent).toContain('Solo se aceptan archivos JPG o PNG');
    expect(enviar.disabled).toBe(true);

    elegirArchivo(input, archivoDePrueba('grande.png', 'image/png', 2 * 1024 * 1024 + 1));
    await stable();
    expect(dialog.querySelector('.field__error')?.textContent).toContain('el máximo permitido es 2 MB');
    expect(enviar.disabled).toBe(true);
    backend.expectNone(`/api/estudiantes/${ID}/fotografia`);
  });

  it('sube la foto en el campo "fotografia", notifica y recarga el detalle', async () => {
    const { input, enviar, dialog, stable, backend, el } = await abrirDialogo();
    const foto = archivoDePrueba('carne.jpg', 'image/jpeg', 2048);
    elegirArchivo(input, foto);
    await stable();
    expect(enviar.disabled).toBe(false);
    enviar.click();
    await stable();

    const req = backend.expectOne(`/api/estudiantes/${ID}/fotografia`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('fotografia')).toMatchObject({ name: 'carne.jpg', type: 'image/jpeg', size: foto.size });
    req.flush(CON_FOTO.estudiante);
    await stable();

    expect(dialog.open).toBe(false);
    expect(TestBed.inject(NotificationService).toasts()[0].title).toBe('Se actualizó la fotografía.');
    backend.expectOne(URL).flush(CON_FOTO);
    await stable();
    expect(el.querySelector<HTMLImageElement>('img.profile__photo')?.getAttribute('src')).toBe(URL_FOTO);
  });

  it('si el módulo rechaza la foto (413) lo explica dentro del diálogo', async () => {
    const { input, enviar, dialog, stable, backend } = await abrirDialogo();
    elegirArchivo(input, archivoDePrueba('carne.png', 'image/png', 2048));
    await stable();
    enviar.click();
    await stable();

    backend
      .expectOne(`/api/estudiantes/${ID}/fotografia`)
      .flush({ mensaje: 'La fotografía supera el tamaño máximo permitido de 2 MB' }, { status: 413, statusText: 'Payload Too Large' });
    await stable();
    expect(dialog.open).toBe(true);
    const alerta = dialog.querySelector('[role="alert"]')?.textContent;
    expect(alerta).toContain('El archivo es demasiado grande');
    expect(alerta).toContain('La fotografía supera el tamaño máximo permitido de 2 MB');
  });
});

describe('EstudianteDetalleComponent: layout del perfil', () => {
  it('la foto y su botón van en una columna junto a los datos personales, de contacto y del programa', async () => {
    const { fixture, backend, el } = await render('ADMIN');
    backend.expectOne(URL).flush(DETALLE_README);
    await fixture.whenStable();

    const perfil = el.querySelector('.profile')!;
    const [media, cuerpo] = [...perfil.children];
    expect(media.classList).toContain('profile__media');
    expect(media.querySelector('.profile__photo')).not.toBeNull();
    expect(media.querySelector('.profile__photo-button')?.textContent?.trim()).toBe('Subir foto');
    expect(cuerpo.classList).toContain('profile__body');

    const grupos = [...cuerpo.querySelectorAll('.profile__group-title')].map((h) => h.textContent);
    expect(grupos).toEqual(['Datos personales', 'Contacto', 'Programa']);
    // La fecha se muestra en español y sin correrse un día por la zona horaria
    expect(cuerpo.textContent).toContain('20 de mayo de 2003');
    expect(cuerpo.textContent).toContain('Calle 10 #5-30, Sogamoso');
    expect(cuerpo.textContent).toContain('ISC-01');
  });
});
