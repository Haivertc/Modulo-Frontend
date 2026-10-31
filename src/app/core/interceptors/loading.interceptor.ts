import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';

import { SKIP_LOADING } from '../http/http-context';
import { LoadingService } from '../loading/loading.service';

/** Registra cada petición en `LoadingService` desde que se suscribe hasta que termina, falla o se cancela. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) {
    return next(req);
  }

  const loading = inject(LoadingService);
  return defer(() => {
    loading.start();
    return next(req).pipe(finalize(() => loading.stop()));
  });
};
