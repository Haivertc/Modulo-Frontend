/** Códigos de error de negocio que el backend envía en `errorType`. */
export type ErrorType =
  | 'CupoAgotado'
  | 'InscripcionDuplicada'
  | 'EstudianteNoExiste'
  | 'EstudianteInactivo'
  | 'CursoNoExiste'
  | 'CursoInactivo'
  | 'CambioNoPermitido'
  | 'ServicioNoDisponible';

/** Cuerpo de error `{ message, errorType }` (409, 422 y 503). */
export interface ErrorResponse {
  message: string;
  errorType?: ErrorType | (string & {});
}
