import { HttpContextToken } from '@angular/common/http';

/** Excluye una petición del retraso simulado. */
export const SKIP_LATENCY = new HttpContextToken<boolean>(() => false);

/** Excluye una petición del indicador global de carga (p. ej. sondeos en segundo plano). */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);
