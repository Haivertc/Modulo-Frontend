import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  template: `
    <div class="status" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      {{ message() }}
    </div>
  `,
  styles: `
    .status {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--color-ink-muted);
    }

    .spinner {
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid var(--color-line);
      border-top-color: var(--color-ink);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  readonly message = input('Cargando…');
}
