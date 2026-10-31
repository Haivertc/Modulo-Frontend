import { inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { describeGatewayError } from '../http/gateway-error';
import { ConfirmOptions, ConfirmService } from './confirm.service';
import { NotificationService } from './notification.service';

export interface DeleteRequest {
  /** Identifica el registro mientras se elimina (para deshabilitar su botón). */
  key: string;
  confirm: ConfirmOptions;
  request: () => Observable<unknown>;
  successMessage: string;
  onSuccess: () => void;
}

/**
 * Flujo de eliminación: confirmación, DELETE, notificación y acción posterior
 * (recargar el listado o volver a él). Debe llamarse en un contexto de inyección.
 */
export function deleteAction() {
  const confirmService = inject(ConfirmService);
  const notifications = inject(NotificationService);
  const deleting = signal<string | null>(null);

  return {
    deleting: deleting.asReadonly(),
    async run(options: DeleteRequest): Promise<void> {
      if (deleting() !== null || !(await confirmService.confirm(options.confirm))) return;
      deleting.set(options.key);
      options.request().subscribe({
        next: () => {
          deleting.set(null);
          notifications.success(options.successMessage);
          options.onSuccess();
        },
        error: (error: unknown) => {
          deleting.set(null);
          const view = describeGatewayError(error, 'El registro ya no existe; es posible que alguien lo haya eliminado.');
          notifications.error(view.title, view.message);
        },
      });
    },
  };
}
