import { Observable, catchError, map, of, startWith } from 'rxjs';

import { GatewayErrorView, describeGatewayError } from './gateway-error';

/** Estado de una carga HTTP para las vistas: cargando, lista o con error. */
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: GatewayErrorView };

export const LOADING: LoadState<never> = { status: 'loading' };

/** Convierte una petición en una secuencia de estados; los errores se traducen con `describeGatewayError`. */
export function toLoadState<T>(source: Observable<T>, notFoundMessage: string): Observable<LoadState<T>> {
  return source.pipe(
    map((data): LoadState<T> => ({ status: 'ready', data })),
    catchError((error: unknown) =>
      of<LoadState<T>>({ status: 'error', error: describeGatewayError(error, notFoundMessage) }),
    ),
    startWith<LoadState<T>>(LOADING),
  );
}
