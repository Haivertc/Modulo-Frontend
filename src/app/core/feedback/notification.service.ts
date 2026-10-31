import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  title: string;
  message?: string;
}

const DURATION_MS = { success: 4000, error: 8000 };

/** Notificaciones breves (toasts). Las muestra `ToastContainerComponent` dentro del layout. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly items = signal<Toast[]>([]);

  readonly toasts = this.items.asReadonly();

  success(title: string): void {
    this.push({ kind: 'success', title });
  }

  error(title: string, message?: string): void {
    this.push({ kind: 'error', title, message });
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  private push(toast: Omit<Toast, 'id'>): void {
    const id = this.nextId++;
    this.items.update((list) => [...list, { ...toast, id }]);
    setTimeout(() => this.dismiss(id), DURATION_MS[toast.kind]);
  }
}
