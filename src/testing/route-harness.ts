import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { NotificationService } from '../app/core/feedback/notification.service';

/** Componente vacío para las rutas de destino (p. ej. el listado al que se redirige). */
@Component({ template: '' })
export class EmptyRouteComponent {}

/**
 * Monta rutas reales (con enlace de parámetros a inputs) y navega a `url`.
 * Devuelve utilidades para interactuar con el DOM y el backend simulado.
 */
export async function renderRoute(routes: Routes, url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(routes, withComponentInputBinding()),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();

  const el = harness.fixture.nativeElement as HTMLElement;
  const backend = TestBed.inject(HttpTestingController);
  const stable = () => harness.fixture.whenStable();

  return {
    el,
    backend,
    stable,
    router: TestBed.inject(Router),
    notifications: TestBed.inject(NotificationService),
    /** Escribe en un input/textarea o elige en un select, como lo haría el usuario. */
    type(selector: string, value: string) {
      const field = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
      if (!field) throw new Error(`No existe el campo ${selector}`);
      field.value = value;
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
      field.dispatchEvent(new Event('blur'));
    },
    async submit() {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await stable();
    },
    /** Texto del error mostrado junto al campo. */
    fieldError(id: string): string | undefined {
      return el.querySelector(`#${id}`)?.closest('.field')?.querySelector('.field__error')?.textContent?.trim();
    },
    async flush(req: TestRequest, body: Parameters<TestRequest['flush']>[0], init?: { status: number; statusText: string }) {
      req.flush(body, init);
      await stable();
    },
  };
}

export type RouteHarness = Awaited<ReturnType<typeof renderRoute>>;

export function formRoutes(base: string, component: Type<unknown>): Routes {
  return [
    { path: base, component: EmptyRouteComponent },
    { path: `${base}/nuevo`, component },
    { path: `${base}/:id/editar`, component },
  ];
}
