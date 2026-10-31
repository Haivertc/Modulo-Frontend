import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Texto del botón que confirma; debe nombrar la acción (p. ej. "Eliminar materia"). */
  confirmLabel: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Diálogo de confirmación genérico. Lo muestra `ConfirmDialogComponent` dentro del layout. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly current = signal<PendingConfirm | null>(null);

  readonly pending = this.current.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise((resolve) => this.current.set({ ...options, resolve }));
  }

  settle(confirmed: boolean): void {
    this.current()?.resolve(confirmed);
    this.current.set(null);
  }
}
