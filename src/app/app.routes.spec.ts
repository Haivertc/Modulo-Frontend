import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../environments/environment';
import { appConfig } from './app.config';
import { APP_CONFIG } from './core/config/app-config';

const STORAGE_KEY = 'gestion-academica.auth.token';

function tokenVigente(): string {
  const now = Math.floor(Date.now() / 1000);
  return `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ sub: 'admin', exp: now + 3600 }))}.firma`;
}

async function harness(conSesion: boolean) {
  localStorage.clear();
  if (conSesion) localStorage.setItem(STORAGE_KEY, tokenVigente());
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      // Sin latencia simulada, para que la petición salga al estabilizarse la vista.
      { provide: APP_CONFIG, useValue: { ...environment, latency: { enabled: false, delayMs: 0 } } },
    ],
  });
  return RouterTestingHarness.create();
}

describe('Rutas', () => {
  it('la raíz redirige estrictamente a /login, con o sin sesión', async () => {
    for (const conSesion of [false, true]) {
      TestBed.resetTestingModule();
      const h = await harness(conSesion);
      await h.navigateByUrl('/');
      expect(TestBed.inject(Router).url).toBe('/login');
      expect((h.fixture.nativeElement as HTMLElement).querySelector('app-login')).not.toBeNull();
    }
  });

  it('sin sesión, /estudiantes, /materias e /inscripciones redirigen al login recordando la URL', async () => {
    for (const ruta of ['/estudiantes', '/materias', '/inscripciones']) {
      TestBed.resetTestingModule();
      const h = await harness(false);
      await h.navigateByUrl(ruta);
      expect(TestBed.inject(Router).url).toBe(`/login?returnUrl=${encodeURIComponent(ruta)}`);
    }
  });

  it('con sesión, /estudiantes se renderiza dentro del layout principal', async () => {
    const h = await harness(true);
    await h.navigateByUrl('/estudiantes');

    expect(TestBed.inject(Router).url).toBe('/estudiantes');
    await h.fixture.whenStable();
    const el = h.fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-main-layout nav[aria-label="Principal"]')).not.toBeNull();
    expect(el.querySelector('app-main-layout app-estudiantes-list')).not.toBeNull();
    expect(el.querySelector('[aria-current="page"]')?.textContent).toContain('Estudiantes');
    TestBed.inject(HttpTestingController).expectOne((r) => r.url === '/api/estudiantes');
  });

  it('el detalle se renderiza como ruta hija del layout', async () => {
    const h = await harness(true);
    await h.navigateByUrl('/estudiantes/abc');

    await h.fixture.whenStable();
    const el = h.fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-main-layout app-estudiante-detalle')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectOne('/api/estudiantes/abc/detalle');
  });

  it('/login queda fuera del layout', async () => {
    const h = await harness(false);
    await h.navigateByUrl('/login');

    await h.fixture.whenStable();
    const el = h.fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-login')).not.toBeNull();
    expect(el.querySelector('app-main-layout')).toBeNull();
  });

  it('sin sesión, las rutas hijas redirigen al login', async () => {
    const h = await harness(false);
    await h.navigateByUrl('/estudiantes');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Festudiantes');
  });

  it('"Cerrar sesión" borra el token y lleva a /login', async () => {
    const h = await harness(true);
    await h.navigateByUrl('/materias');
    await h.fixture.whenStable();
    expect((h.fixture.nativeElement as HTMLElement).querySelector('app-main-layout app-materias-list')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url === '/api/materias');

    (h.fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.topbar__logout')!.click();
    await h.fixture.whenStable();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
