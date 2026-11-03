import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { TipoArchivo } from '../../core/files/formatos';
import { GatewayErrorView, describeGatewayError } from '../../core/http/gateway-error';
import { ErrorStateComponent } from './error-state.component';

const formatoMb = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const megas = (bytes: number) => `${formatoMb.format(bytes / (1024 * 1024))} MB`;
// El peso del archivo se redondea hacia arriba: 2 MB + 1 byte se muestra "2,01 MB", no "2 MB"
const megasArriba = (bytes: number) => `${formatoMb.format(Math.ceil((bytes / (1024 * 1024)) * 100) / 100)} MB`;

/**
 * Valida extensión, tipo MIME y peso antes de enviar. Devuelve el motivo del rechazo o `null`.
 * Es una ayuda para el usuario: el módulo vuelve a validar (incluida la firma binaria).
 */
export function validarArchivo(archivo: File, tipos: readonly TipoArchivo[], maxBytes: number): string | null {
  const nombre = archivo.name.toLowerCase();
  const extension = nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')) : '';
  const tipo = tipos.find((t) => t.extensiones.includes(extension));
  const permitidos = tipos.map((t) => t.etiqueta).join(' o ');

  // Estricto: la extensión y el tipo MIME deben coincidir con un mismo formato permitido
  if (!tipo || archivo.type !== tipo.mime) {
    return `Formato no permitido. Solo se aceptan archivos ${permitidos}.`;
  }
  if (archivo.size === 0) {
    return 'El archivo está vacío.';
  }
  if (archivo.size > maxBytes) {
    return `El archivo pesa ${megasArriba(archivo.size)}; el máximo permitido es ${megas(maxBytes)}.`;
  }
  return null;
}

let siguienteId = 0;

/**
 * Diálogo modal nativo (`<dialog>`) para elegir un archivo, validarlo y subirlo.
 * El padre lo abre con `abrir()` y recibe la respuesta del módulo en `subido`.
 */
@Component({
  selector: 'app-file-upload-dialog',
  imports: [ErrorStateComponent],
  template: `
    <dialog #dialog class="upload" [attr.aria-labelledby]="ids.titulo" (cancel)="alCancelar($event)" (close)="alCerrar()">
      <form (submit)="enviar($event)" novalidate>
        <h2 [id]="ids.titulo" class="upload__title">{{ titulo() }}</h2>
        @if (descripcion()) {
          <p class="upload__description">{{ descripcion() }}</p>
        }

        <div class="field">
          <label [for]="ids.input">Archivo</label>
          <input #input type="file" [id]="ids.input" [accept]="accept()" [disabled]="enviando()"
            [attr.aria-invalid]="!!errorArchivo()"
            [attr.aria-describedby]="ids.ayuda + (errorArchivo() ? ' ' + ids.error : '')"
            (change)="seleccionar(input)" />
          <p [id]="ids.ayuda" class="upload__hint">{{ ayuda() }}</p>
          @if (errorArchivo(); as msg) {
            <p [id]="ids.error" class="field__error">{{ msg }}</p>
          }
        </div>

        @if (errorEnvio(); as err) {
          <app-error-state class="upload__error" [error]="err" [retryable]="false" />
        }

        <div class="upload__actions">
          <button type="button" class="button button--secondary" [disabled]="enviando()" (click)="cerrar()">Cancelar</button>
          <button type="submit" class="button" [disabled]="!archivo() || enviando()">
            {{ enviando() ? 'Subiendo…' : etiquetaEnviar() }}
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .upload {
      width: min(calc(100% - 2rem), 30rem);
      padding: var(--space-6);
      color: var(--color-ink);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);

      &::backdrop {
        background: rgb(31 42 55 / 0.45);
      }
    }

    .upload__title {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
    }

    .upload__description {
      margin: 0 0 var(--space-4);
      color: var(--color-ink-muted);
    }

    .field input[type='file'] {
      padding: var(--space-2) var(--space-3);
    }

    .upload__hint {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-ink-muted);
    }

    .upload__error {
      display: block;
      margin-top: var(--space-4);
    }

    .upload__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadDialogComponent {
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly tipos = input.required<readonly TipoArchivo[]>();
  readonly maxBytes = input.required<number>();
  readonly etiquetaEnviar = input('Subir');
  /** Mensaje si el registro ya no existe (404) al subir. */
  readonly mensajeNoEncontrado = input('El registro ya no existe; es posible que alguien lo haya eliminado.');
  /** Petición de subida; se invoca con el archivo ya validado. */
  readonly subir = input.required<(archivo: File) => Observable<unknown>>();
  readonly subido = output<unknown>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly archivo = signal<File | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly errorEnvio = signal<GatewayErrorView | null>(null);
  protected readonly enviando = signal(false);
  private envio?: Subscription;

  private readonly n = siguienteId++;
  protected readonly ids = {
    titulo: `subida-${this.n}-titulo`,
    input: `subida-${this.n}-archivo`,
    ayuda: `subida-${this.n}-ayuda`,
    error: `subida-${this.n}-error`,
  };

  protected readonly accept = computed(() =>
    this.tipos()
      .flatMap((t) => [t.mime, ...t.extensiones])
      .join(','),
  );
  protected readonly ayuda = computed(
    () => `Formatos: ${this.tipos().map((t) => t.etiqueta).join(' o ')}. Tamaño máximo: ${megas(this.maxBytes())}.`,
  );

  abrir(): void {
    this.archivo.set(null);
    this.errorArchivo.set(null);
    this.errorEnvio.set(null);
    this.input().nativeElement.value = '';
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  cerrar(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  protected seleccionar(input: HTMLInputElement): void {
    this.errorEnvio.set(null);
    const archivo = input.files?.[0] ?? null;
    if (!archivo) {
      this.archivo.set(null);
      this.errorArchivo.set(null);
      return;
    }
    const motivo = validarArchivo(archivo, this.tipos(), this.maxBytes());
    this.errorArchivo.set(motivo);
    this.archivo.set(motivo ? null : archivo);
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    const archivo = this.archivo();
    if (!archivo || this.enviando()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.envio = this.subir()(archivo).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.cerrar();
        this.subido.emit(respuesta);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errorEnvio.set(describeGatewayError(error, this.mensajeNoEncontrado()));
      },
    });
  }

  /** Esc no cierra mientras se sube el archivo. */
  protected alCancelar(event: Event): void {
    if (this.enviando()) event.preventDefault();
  }

  protected alCerrar(): void {
    this.envio?.unsubscribe();
    this.enviando.set(false);
  }
}
