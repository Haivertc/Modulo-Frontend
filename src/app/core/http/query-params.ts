import { HttpParams } from '@angular/common/http';

/** Construye `HttpParams` omitiendo valores vacíos, para no enviar filtros que el usuario no aplicó. */
export function toHttpParams(values: Record<string, string | number | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') {
      params = params.set(key, value);
    }
  }
  return params;
}
