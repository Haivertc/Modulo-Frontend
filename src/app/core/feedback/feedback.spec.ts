import { TestBed } from '@angular/core/testing';

import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ToastContainerComponent } from '../../shared/ui/toast-container.component';
import { ConfirmService } from './confirm.service';
import { NotificationService } from './notification.service';

describe('ConfirmDialogComponent + ConfirmService', () => {
  async function render() {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, confirm: TestBed.inject(ConfirmService) };
  }

  it('abre el diálogo con el texto pedido y resuelve true al confirmar', async () => {
    const { fixture, el, confirm } = await render();
    const result = confirm.confirm({ title: '¿Eliminar la materia Ética?', message: 'No se puede deshacer.', confirmLabel: 'Eliminar materia' });
    await fixture.whenStable();

    const dialog = el.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('¿Eliminar la materia Ética?');
    const [cancelar, eliminar] = dialog.querySelectorAll('button');
    expect(cancelar.textContent).toContain('Cancelar');
    expect(cancelar.hasAttribute('autofocus')).toBe(true);
    eliminar.click();

    expect(await result).toBe(true);
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });

  it('resuelve false al cancelar', async () => {
    const { fixture, el, confirm } = await render();
    const result = confirm.confirm({ title: 't', message: 'm', confirmLabel: 'Eliminar' });
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('dialog button')!.click();
    expect(await result).toBe(false);
  });
});

describe('NotificationService + ToastContainerComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra el toast y lo retira solo después de unos segundos', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ToastContainerComponent);
    const notifications = TestBed.inject(NotificationService);

    notifications.success('Se creó la materia Ética.');
    fixture.detectChanges();
    const toast = (fixture.nativeElement as HTMLElement).querySelector('.toast');
    expect(toast?.textContent).toContain('Se creó la materia Ética.');
    expect(toast?.getAttribute('role')).toBe('status');

    vi.advanceTimersByTime(4000);
    expect(notifications.toasts()).toEqual([]);
  });

  it('los errores usan role="alert" y se pueden cerrar', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    const notifications = TestBed.inject(NotificationService);

    notifications.error('No se pudo eliminar', 'El módulo de Materias no responde');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.toast')?.getAttribute('role')).toBe('alert');

    el.querySelector<HTMLButtonElement>('.toast__close')!.click();
    expect(notifications.toasts()).toEqual([]);
  });
});
