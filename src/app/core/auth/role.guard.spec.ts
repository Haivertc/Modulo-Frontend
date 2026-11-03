import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { cerrarSesion, iniciarSesionComo, tokenDePrueba } from '../../../testing/session';
import { NotificationService } from '../feedback/notification.service';
import { AuthService } from './auth.service';
import { adminGuard } from './role.guard';

const STORAGE_KEY = 'gestion-academica.auth.token';

@Component({ template: 'listado' })
class ListadoComponent {}

@Component({ template: 'formulario' })
class FormularioComponent {}

async function navegar(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'materias', component: ListadoComponent },
        { path: 'materias/nuevo', component: FormularioComponent, canActivate: [adminGuard] },
        { path: 'materias/:id/editar', component: FormularioComponent, canActivate: [adminGuard] },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return { harness, router: TestBed.inject(Router), notifications: TestBed.inject(NotificationService) };
}

afterEach(() => cerrarSesion());

describe('AuthService: rol del JWT', () => {
  const auth = (token: string | null) => {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.inject(AuthService);
  };

  it('lee el claim rol del payload', () => {
    expect(auth(tokenDePrueba('ADMIN')).rol()).toBe('ADMIN');
  });

  it('ESTUDIANTE no es admin', () => {
    const servicio = auth(tokenDePrueba('ESTUDIANTE'));
    expect(servicio.rol()).toBe('ESTUDIANTE');
    expect(servicio.esAdmin()).toBe(false);
  });

  it('sin rol, con un rol desconocido o con el token vencido no hay rol', () => {
    expect(auth(tokenDePrueba(null)).rol()).toBeNull();
    TestBed.resetTestingModule();
    expect(auth(tokenDePrueba('DOCENTE')).esAdmin()).toBe(false);
    TestBed.resetTestingModule();
    expect(auth(tokenDePrueba('ADMIN', { vencido: true })).rol()).toBeNull();
  });

  it('al cerrar sesión deja de ser admin', () => {
    const servicio = auth(tokenDePrueba('ADMIN'));
    expect(servicio.esAdmin()).toBe(true);
    servicio.logout();
    expect(servicio.esAdmin()).toBe(false);
  });
});

describe('adminGuard', () => {
  it('ADMIN entra a crear y editar', async () => {
    iniciarSesionComo('ADMIN');
    const { harness, router } = await navegar('/materias/nuevo');
    expect(router.url).toBe('/materias/nuevo');
    expect(harness.routeNativeElement?.textContent).toContain('formulario');
  });

  it('ESTUDIANTE que entra por URL vuelve al listado con "Acceso denegado"', async () => {
    iniciarSesionComo('ESTUDIANTE');
    const { harness, router, notifications } = await navegar('/materias/3/editar?x=1');

    expect(router.url).toBe('/materias');
    expect(harness.routeNativeElement?.textContent).toContain('listado');
    expect(notifications.toasts()[0]).toMatchObject({ kind: 'error', title: 'Acceso denegado' });
  });
});
