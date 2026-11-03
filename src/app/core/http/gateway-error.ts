import { HttpErrorResponse } from '@angular/common/http';

export interface GatewayErrorView {
  status: number;
  title: string;
  message: string;
}

/** Puertos de los microservicios según `application.properties` del Gateway. */
const MODULO_POR_PUERTO: Record<string, string> = {
  '3001': 'Estudiantes',
  '3002': 'Materias',
  '3003': 'Inscripciones',
};

/** Traduce un error del Gateway a un mensaje que explica qué pasó y qué hacer. */
export function describeGatewayError(error: unknown, notFoundMessage: string): GatewayErrorView {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, title: 'No se pudo mostrar la información', message: 'Recarga la página e intenta de nuevo.' };
  }

  const gatewayMessage = readGatewayMessage(error);
  const { status } = error;

  if (status === 404) {
    return { status, title: 'No encontramos el registro', message: notFoundMessage };
  }
  if (status === 401) {
    return {
      status,
      title: 'Se necesita una sesión válida',
      message: 'El Gateway rechazó la petición porque falta un token válido. Inicia sesión e intenta de nuevo.',
    };
  }
  if (status === 400 || status === 409 || status === 422) {
    return {
      status,
      title: 'El sistema no aceptó los datos',
      message: isDuplicateKey(error)
        ? 'Ya existe un registro con ese valor único (por ejemplo, el mismo correo). Usa otro valor.'
        : (gatewayMessage ?? 'Revisa los campos del formulario e intenta de nuevo.'),
    };
  }
  if (status === 413) {
    return {
      status,
      title: 'El archivo es demasiado grande',
      message: gatewayMessage ?? 'Elige un archivo más liviano e intenta de nuevo.',
    };
  }
  if (status === 502) {
    const puerto = gatewayMessage?.match(/:(\d{4})/)?.[1];
    const modulo = puerto ? MODULO_POR_PUERTO[puerto] : undefined;
    return {
      status,
      title: modulo ? `El módulo de ${modulo} no responde` : 'Un módulo del sistema no responde',
      message: 'El Gateway no pudo reunir toda la información. Intenta de nuevo en unos minutos.',
    };
  }
  // Sin cuerpo JSON: el proxy de desarrollo no alcanzó el Gateway (o la red falló).
  if (status === 0 || status === 504 || (status === 500 && gatewayMessage === undefined)) {
    return {
      status,
      title: 'No hay conexión con el API Gateway',
      message: 'Verifica que el Gateway esté en ejecución en el puerto 3000 e intenta de nuevo.',
    };
  }
  return {
    status,
    title: `El Gateway respondió con un error (${status})`,
    message: gatewayMessage ?? 'Intenta de nuevo. Si el problema continúa, revisa los registros del Gateway.',
  };
}

/**
 * Cada pieza responde errores con su propia forma: Materias `{ message, error: "BAD_REQUEST" }`,
 * Inscripciones `{ message }`, Estudiantes `{ mensaje, error: {...} }` y el Gateway `{ error }`.
 * Se prefiere el texto más descriptivo.
 */
function readGatewayMessage(error: HttpErrorResponse): string | undefined {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return undefined;
  for (const key of ['message', 'mensaje', 'error']) {
    const value: unknown = (body as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

/**
 * Índice único violado (p. ej. correo de estudiante repetido). Estudiantes responde
 * `{ error: { code: 'P2002' } }` desde la migración a PostgreSQL (Prisma); se acepta también
 * el `code: 11000` de la versión con MongoDB.
 */
function isDuplicateKey(error: HttpErrorResponse): boolean {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return false;
  const inner: unknown = (body as Record<string, unknown>)['error'];
  if (typeof inner !== 'object' || inner === null) return false;
  const code = (inner as Record<string, unknown>)['code'];
  return code === 'P2002' || code === 11000;
}
