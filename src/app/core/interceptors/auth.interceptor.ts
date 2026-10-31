import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { APP_CONFIG } from '../config/app-config';

/**
 * Adjunta `Authorization: Bearer <token>` a las peticiones de `/api/**` (excepto el login).
 * Si una ruta protegida responde 401, el token ya no sirve: cierra la sesión y lleva al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const { auth: authConfig, apiBaseUrl } = inject(APP_CONFIG);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!req.url.startsWith(apiBaseUrl) || auth.isLoginRequest(req.url)) {
    return next(req);
  }

  const token = auth.token();
  const request =
    authConfig.attachToken && token && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
