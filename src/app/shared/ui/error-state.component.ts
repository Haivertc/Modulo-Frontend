import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GatewayErrorView } from '../../core/http/gateway-error';

@Component({
  selector: 'app-error-state',
  template: `
    <section class="alert" role="alert">
      <h2 class="alert__title">{{ error().title }}</h2>
      <p class="alert__message">{{ error().message }}</p>
      @if (retryable()) {
        <button type="button" class="button" (click)="retry.emit()">Reintentar</button>
      }
    </section>
  `,
  styles: `
    .alert {
      max-width: var(--measure);
      padding: var(--space-6);
      background: var(--color-surface);
      border: 1px solid var(--color-grade-fail);
      border-radius: var(--radius-sm);
    }

    .alert__title {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
      color: var(--color-grade-fail);
    }

    .alert__message {
      margin: 0 0 var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly error = input.required<GatewayErrorView>();
  readonly retryable = input(true);
  readonly retry = output<void>();
}
