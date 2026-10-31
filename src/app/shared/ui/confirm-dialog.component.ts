import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { ConfirmService } from '../../core/feedback/confirm.service';

/**
 * Diálogo modal nativo (`<dialog>`): atrapa el foco, se cierra con Esc y devuelve el foco
 * al control que lo abrió. El foco inicial va a "Cancelar" para que Enter no elimine por accidente.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <!-- El contenido existe siempre: así showModal() encuentra el botón con autofocus al abrir. -->
    <dialog #dialog class="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-message" (close)="onClose()">
      <h2 id="confirm-title" class="confirm__title">{{ confirm.pending()?.title }}</h2>
      <p id="confirm-message" class="confirm__message">{{ confirm.pending()?.message }}</p>
      <div class="confirm__actions">
        <button type="button" class="button button--secondary" autofocus (click)="confirm.settle(false)">Cancelar</button>
        <button type="button" class="button button--danger" (click)="confirm.settle(true)">{{ confirm.pending()?.confirmLabel }}</button>
      </div>
    </dialog>
  `,
  styles: `
    .confirm {
      width: min(calc(100% - 2rem), 28rem);
      padding: var(--space-6);
      color: var(--color-ink);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);

      &::backdrop {
        background: rgb(31 42 55 / 0.45);
      }
    }

    .confirm__title {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
    }

    .confirm__message {
      margin: 0 0 var(--space-6);
      color: var(--color-ink-muted);
    }

    .confirm__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.confirm.pending() !== null;
      if (open && !dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      } else if (!open && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  /** Esc o un cierre nativo equivalen a cancelar. */
  protected onClose(): void {
    if (this.confirm.pending()) this.confirm.settle(false);
  }
}
