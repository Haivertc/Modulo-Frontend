import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/** Configuración de ejecución del frontend. Se define por entorno en `src/environments/`. */
export interface AppConfig {
  production: boolean;
  /** Prefijo de las rutas del API Gateway. En desarrollo lo resuelve `proxy.conf.json`. */
  apiBaseUrl: string;
  auth: {
    /** Adjunta `Authorization: Bearer <token>` (emitido por `POST /api/auth/login`) a las peticiones del API. */
    attachToken: boolean;
  };
  latency: {
    /** Retrasa cada petición HTTP para probar estados de carga. */
    enabled: boolean;
    delayMs: number;
  };
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment,
});
