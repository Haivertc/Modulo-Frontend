import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { describeGatewayError } from '../../../core/http/gateway-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query param `returnUrl`, enlazado con `withComponentInputBinding()`. */
  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: ['', Validators.required],
    clave: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { usuario, clave } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(usuario.trim(), clave).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? 'Usuario o clave incorrectos. Revísalos e intenta de nuevo.'
            : describeGatewayError(error, 'No se encontró el servicio de inicio de sesión.').message,
        );
      },
    });
  }
}

/** Solo rutas internas, para no redirigir a otro sitio desde un enlace manipulado. */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/';
}
