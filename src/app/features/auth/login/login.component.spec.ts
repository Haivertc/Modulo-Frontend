import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';

async function render(returnUrl?: string) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  if (returnUrl) {
    fixture.componentRef.setInput('returnUrl', returnUrl);
  }
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, type, submit, backend: TestBed.inject(HttpTestingController) };
}

describe('LoginComponent', () => {
  it('no envía el formulario vacío y señala los campos', async () => {
    const { el, submit, backend } = await render();
    await submit();
    expect(el.textContent).toContain('Escribe tu usuario.');
    expect(el.textContent).toContain('Escribe tu clave.');
    backend.expectNone('/api/auth/login');
  });

  it('deshabilita el botón durante la carga y muestra el error de credenciales', async () => {
    const { fixture, el, type, submit, backend } = await render();
    type('#usuario', 'admin');
    type('#clave', 'mala');
    await submit();

    const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Iniciando sesión');

    backend
      .expectOne('/api/auth/login')
      .flush({ error: 'Usuario o clave incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(button.disabled).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Usuario o clave incorrectos');
  });

  it('con credenciales válidas navega a la URL de retorno', async () => {
    const { fixture, type, submit, backend } = await render('/estudiantes/abc');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    type('#usuario', 'admin');
    type('#clave', 'admin123');
    await submit();

    backend.expectOne('/api/auth/login').flush({ token: 'a.b.c' });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/estudiantes/abc');
  });

  it('ignora una URL de retorno externa', async () => {
    const { fixture, type, submit, backend } = await render('//sitio-externo.com');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    type('#usuario', 'admin');
    type('#clave', 'admin123');
    await submit();

    backend.expectOne('/api/auth/login').flush({ token: 'a.b.c' });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/estudiantes');
  });

  it('sin URL de retorno (o con "/") entra a /estudiantes, no a la raíz que redirige al login', async () => {
    for (const returnUrl of [undefined, '/']) {
      TestBed.resetTestingModule();
      const { fixture, type, submit, backend } = await render(returnUrl);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      type('#usuario', 'admin');
      type('#clave', 'admin123');
      await submit();

      backend.expectOne('/api/auth/login').flush({ token: 'a.b.c' });
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledWith('/estudiantes');
    }
  });
});
