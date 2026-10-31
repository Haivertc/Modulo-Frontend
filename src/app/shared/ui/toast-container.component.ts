import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../core/feedback/notification.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class.toast--error]="toast.kind === 'error'" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <div class="toast__body">
            <p class="toast__title">{{ toast.title }}</p>
            @if (toast.message) {
              <p class="toast__message">{{ toast.message }}</p>
            }
          </div>
          <button type="button" class="toast__close" (click)="notifications.dismiss(toast.id)">
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">Cerrar notificación</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      left: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      width: min(100%, 24rem);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      color: var(--color-surface);
      background: var(--color-ink);
      border-radius: var(--radius-sm);
      pointer-events: auto;
      animation: toast-in var(--duration-base) var(--ease-out);
    }

    .toast--error {
      color: var(--color-ink);
      background: var(--color-surface);
      border: 1px solid var(--color-grade-fail);
    }

    .toast__body {
      flex: 1;
    }

    .toast__title,
    .toast__message {
      margin: 0;
    }

    .toast__title {
      font-weight: 600;
    }

    .toast--error .toast__title {
      color: var(--color-grade-fail);
    }

    .toast__message {
      margin-top: var(--space-1);
      font-size: var(--text-sm);
    }

    .toast__close {
      min-width: 2rem;
      min-height: 2rem;
      font-size: var(--text-lg);
      line-height: 1;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  protected readonly notifications = inject(NotificationService);
}
