import { ElementRef, Injector, Signal, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subject, combineLatest, of, startWith, switchMap } from 'rxjs';

import { NotificationService } from '../feedback/notification.service';
import { GatewayErrorView, describeGatewayError } from '../http/gateway-error';
import { LoadState, toLoadState } from '../http/load-state';

export interface EntityFormConfig<T> {
  /** `:id` de la ruta; sin él el formulario está en modo creación. */
  id: Signal<string | undefined>;
  form: AbstractControl;
  load: (id: string) => Observable<T>;
  /** Rellena el formulario con el registro cargado (modo edición). */
  fill: (data: T) => void;
  notFoundMessage: (id: string) => string;
}

export interface SaveOptions {
  successMessage: string;
  redirectTo: string;
}

/**
 * Lógica común de los formularios de creación/edición: carga del registro, envío, foco en el
 * primer campo inválido, notificación de éxito y redirección al listado.
 * Debe llamarse en un contexto de inyección.
 */
export function entityForm<T>(config: EntityFormConfig<T>) {
  const router = inject(Router);
  const notifications = inject(NotificationService);
  const injector = inject(Injector);
  const host: ElementRef<HTMLElement> = inject(ElementRef);
  const reload$ = new Subject<void>();

  const editing = computed(() => !!config.id());
  const loadState = toSignal(
    combineLatest([toObservable(config.id), reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([id]) =>
        id ? toLoadState(config.load(id), config.notFoundMessage(id)) : of<LoadState<T | null>>({ status: 'ready', data: null }),
      ),
    ),
    { initialValue: { status: 'loading' } as LoadState<T | null> },
  );

  effect(() => {
    const state = loadState();
    if (state.status === 'ready' && state.data !== null) {
      const data = state.data;
      untracked(() => {
        config.fill(data);
        config.form.markAsPristine();
        config.form.markAsUntouched();
      });
    }
  });

  const saving = signal(false);
  const saveError = signal<GatewayErrorView | null>(null);

  return {
    editing,
    loading: computed(() => loadState().status === 'loading'),
    loadError: computed(() => {
      const state = loadState();
      return state.status === 'error' ? state.error : null;
    }),
    saving: saving.asReadonly(),
    saveError: saveError.asReadonly(),
    reload: () => reload$.next(),

    /** Valida y, si todo está bien, devuelve `true`; si no, muestra los errores y enfoca el primero. */
    validate(): boolean {
      if (config.form.valid) return true;
      config.form.markAllAsTouched();
      afterNextRender(
        () => host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        { injector },
      );
      return false;
    },

    /** Ignora la llamada si ya hay un envío en curso (doble clic o Enter repetido). */
    save(request: Observable<unknown>, options: SaveOptions): void {
      if (saving()) return;
      saving.set(true);
      saveError.set(null);
      request.subscribe({
        next: () => {
          notifications.success(options.successMessage);
          void router.navigateByUrl(options.redirectTo);
        },
        error: (error: unknown) => {
          saving.set(false);
          saveError.set(
            describeGatewayError(error, 'El registro ya no existe; es posible que alguien lo haya eliminado.'),
          );
          afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('.form-error')?.focus(), { injector });
        },
      });
    },
  };
}
