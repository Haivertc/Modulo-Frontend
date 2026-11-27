import { HttpErrorResponse } from '@angular/common/http';

import { ErrorType } from '../../models';

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

const SERVICIO_NO_DISPONIBLE = 'Un módulo no está disponible, intenta de nuevo en unos segundos';

/** Mensajes por `errorType` (409, 422 y 503); van antes que la lectura por código HTTP. */
const MENSAJES_POR_TIPO: Partial<Record<ErrorType, { title: string; message: string }>> = {
  CupoAgotado: {
    title: 'El curso no tiene cupos disponibles',
    message: 'Elige otro curso o espera a que se libere un cupo.',
  },
  InscripcionDuplicada: {
    title: 'El estudiante ya está inscrito en este curso',
    message: 'Revisa el listado de inscripciones; no hace falta crearla de nuevo.',
  },
  EstudianteNoExiste: {
    title: 'El estudiante no existe o está inactivo',
    message: 'Verifica el ID del estudiante y que su estado sea ACTIVO.',
  },
  EstudianteInactivo: {
    title: 'El estudiante no existe o está inactivo',
    message: 'Verifica el ID del estudiante y que su estado sea ACTIVO.',
  },
  CursoNoExiste: {
    title: 'El curso no existe o está inactivo',
    message: 'Verifica el ID del curso y que su estado sea ACTIVO.',
  },
  CursoInactivo: {
    title: 'El curso no existe o está inactivo',
    message: 'Verifica el ID del curso y que su estado sea ACTIVO.',
  },
  CambioNoPermitido: {
    title: 'Ese cambio no está permitido',
    message: 'El estudiante y el curso de una inscripción no se pueden cambiar. Cancélala y crea una nueva.',
  },
  ServicioNoDisponible: {
    title: SERVICIO_NO_DISPONIBLE,
    message: 'La operación no se completó. Vuelve a intentarla.',
  },
};

/**
 * Fallos tras los que la petición pudo o no haberse procesado y conviene reintentar con la
 * misma `Idempotency-Key`: sin respuesta (red), 503 del módulo o 504 por tiempo de espera.
 */
export function isRetryableError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 503 || error.status === 504);
}

/** Traduce un error del Gateway a un mensaje que explica qué pasó y qué hacer. */
export function describeGatewayError(error: unknown, notFoundMessage: string): GatewayErrorView {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, title: 'No se pudo mostrar la información', message: 'Recarga la página e intenta de nuevo.' };
  }

  const gatewayMessage = readGatewayMessage(error);
  const { status } = error;

  const errorType = readErrorType(error);
  const porTipo = errorType ? MENSAJES_POR_TIPO[errorType as ErrorType] : undefined;
  if (porTipo) {
    return { status, ...porTipo };
  }

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
  if (status === 503) {
    return {
      status,
      title: SERVICIO_NO_DISPONIBLE,
      message: 'La operación no se completó. Vuelve a intentarla.',
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

/** `errorType` del cuerpo `{ message, errorType }`, si viene. */
function readErrorType(error: HttpErrorResponse): string | undefined {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return undefined;
  const value: unknown = (body as Record<string, unknown>)['errorType'];
  return typeof value === 'string' && value ? value : undefined;
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
