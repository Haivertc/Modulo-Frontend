import { AbstractControl, ValidatorFn, Validators } from '@angular/forms';

/** Mensajes por clave de error de validación. */
export type ErrorMessages = Partial<Record<string, string>>;

const DEFAULT_MESSAGES: ErrorMessages = {
  required: 'Este campo es obligatorio.',
  maxlength: 'El texto es demasiado largo.',
  pattern: 'El formato no es válido.',
  min: 'Debe ser un número positivo.',
};

/** Primer mensaje de error del control, solo después de que el usuario lo tocó o se intentó enviar. */
export function fieldError(control: AbstractControl, messages: ErrorMessages = {}): string | null {
  if (!control.errors || !(control.touched || control.dirty)) return null;
  const key = Object.keys(control.errors)[0];
  return messages[key] ?? DEFAULT_MESSAGES[key] ?? 'Revisa este campo.';
}

/** Correo con usuario, dominio y extensión; `Validators.email` acepta direcciones sin extensión (`a@b`). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** ObjectId de MongoDB: 24 caracteres hexadecimales. */
export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
export const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

/** Campo de texto obligatorio que no acepta solo espacios. */
export const requiredText: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() === '' ? { required: true } : null;

/** Fecha `YYYY-MM-DD` que no puede ser posterior a hoy. */
export const notFutureDate: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value) return null;
  return value > new Date().toISOString().slice(0, 10) ? { futureDate: true } : null;
};

export const positiveInteger: ValidatorFn[] = [Validators.required, Validators.pattern(POSITIVE_INTEGER_PATTERN)];
