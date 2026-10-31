import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, timer } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { SKIP_LATENCY } from '../http/http-context';

/**
 * Simula latencia retrasando el envío de la petición. Como el retraso ocurre antes de
 * `next(req)`, las respuestas y los errores HTTP llegan intactos y la cancelación
 * (unsubscribe) evita que la petición llegue a enviarse.
 */
export const latencyInterceptor: HttpInterceptorFn = (req, next) => {
  const { latency } = inject(APP_CONFIG);

  if (!latency.enabled || latency.delayMs <= 0 || req.context.get(SKIP_LATENCY)) {
    return next(req);
  }

  return timer(latency.delayMs).pipe(switchMap(() => next(req)));
};
