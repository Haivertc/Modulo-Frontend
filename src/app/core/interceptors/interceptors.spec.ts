import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { appConfig } from '../../app.config';
import { authGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { LoadingService } from '../loading/loading.service';

const STORAGE_KEY = 'gestion-academica.auth.token';

/** JWT con la forma del que emite el Gateway (la firma no se valida en el cliente). */
function jwt(expiresInSeconds: number): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'admin', iat: now, exp: now + expiresInSeconds })}.firma`;
}

function setup(overrides: { attachToken?: boolean; latencyMs?: number } = {}) {
  const config: AppConfig = {
    production: false,
    apiBaseUrl: '/api',
    auth: { attachToken: overrides.attachToken ?? true },
    latency: { enabled: (overrides.latencyMs ?? 0) > 0, delayMs: overrides.latencyMs ?? 0 },
  };
  TestBed.configureTestingModule({
    providers: [...appConfig.providers, provideHttpClientTesting(), { provide: APP_CONFIG, useValue: config }],
  });
  const router = TestBed.inject(Router);
  return {
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    loading: TestBed.inject(LoadingService),
    navigate: vi.spyOn(router, 'navigate').mockResolvedValue(true),
  };
}

function login(auth: AuthService, backend: HttpTestingController, token = jwt(3600)): string {
  auth.login('admin', 'admin123').subscribe();
  const req = backend.expectOne('/api/auth/login');
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual({ usuario: 'admin', clave: 'admin123' });
  req.flush({ token });
  return token;
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('hace POST al login, guarda el token en localStorage y cierra la sesión', () => {
    const { auth, backend } = setup();
    expect(auth.isAuthenticated()).toBe(false);

    const token = login(auth, backend);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
    expect(auth.isAuthenticated()).toBe(true);

    auth.logout();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('trata como no autenticado un token expirado', () => {
    localStorage.setItem(STORAGE_KEY, jwt(-60));
    const { auth } = setup();
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe('Interceptores registrados en appConfig', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adjunta Authorization: Bearer a /api/** pero no al login', () => {
    const { http, backend, auth } = setup();
    const token = login(auth, backend);

    http.get('/api/estudiantes').subscribe();
    expect(backend.expectOne('/api/estudiantes').request.headers.get('Authorization')).toBe(`Bearer ${token}`);

    auth.login('admin', 'admin123').subscribe();
    expect(backend.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
  });

  it('no adjunta el token cuando attachToken está desactivado', () => {
    const { http, backend, auth } = setup({ attachToken: false });
    login(auth, backend);
    http.get('/api/estudiantes').subscribe();
    expect(backend.expectOne('/api/estudiantes').request.headers.has('Authorization')).toBe(false);
  });

  it('ante un 401 de una ruta protegida limpia la sesión y redirige al login', () => {
    const { http, backend, auth, navigate } = setup();
    login(auth, backend);

    let error: HttpErrorResponse | undefined;
    http.get('/api/estudiantes/1/detalle').subscribe({ error: (e: HttpErrorResponse) => (error = e) });
    backend
      .expectOne('/api/estudiantes/1/detalle')
      .flush({ error: 'Token inválido o expirado' }, { status: 401, statusText: 'Unauthorized' });

    expect(error?.status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it('un 401 del propio login (credenciales malas) no redirige', () => {
    const { backend, auth, navigate } = setup();
    auth.login('admin', 'mala').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/auth/login')
      .flush({ error: 'Usuario o clave incorrectos' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('retrasa el envío según la latencia configurada y conserva el error HTTP', async () => {
    const { http, backend, loading } = setup({ latencyMs: 50 });
    let error: HttpErrorResponse | undefined;
    http.get('/api/materias').subscribe({ error: (e: HttpErrorResponse) => (error = e) });

    expect(loading.isLoading()).toBe(true);
    backend.expectNone('/api/materias');

    await new Promise((resolve) => setTimeout(resolve, 80));
    backend.expectOne('/api/materias').flush({ error: 'Servicio no disponible' }, { status: 502, statusText: 'Bad Gateway' });

    expect(error?.status).toBe(502);
    expect(error?.error).toEqual({ error: 'Servicio no disponible' });
    expect(loading.isLoading()).toBe(false);
  });
});

describe('authGuard', () => {
  beforeEach(() => localStorage.clear());

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/estudiantes/abc' } as RouterStateSnapshot),
    );

  it('redirige al login con returnUrl si no hay token', () => {
    setup();
    const result = run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Festudiantes%2Fabc');
  });

  it('permite el acceso con un token vigente', () => {
    localStorage.setItem(STORAGE_KEY, jwt(3600));
    setup();
    expect(run()).toBe(true);
  });
});
