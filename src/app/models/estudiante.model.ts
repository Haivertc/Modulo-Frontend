import type { Contacto } from './contacto.model';
import type { Programa } from './programa.model';

/** Metadatos de la fotografía del estudiante almacenada en AWS S3. */
export interface Fotografia {
  clave_s3: string;
  nombre_original: string;
  tipo_mime: string;
  tamano_bytes: number;
  /** URL firmada temporal (1 hora) generada por el módulo en cada lectura. */
  url: string;
}

/** Un DELETE no borra al estudiante: lo deja INACTIVO. */
export type EstadoEstudiante = 'ACTIVO' | 'INACTIVO';

/** Estudiante (módulo Estudiantes). */
export interface Estudiante {
  _id: string;
  nombre: string;
  apellido: string;
  correo: string;
  /** Fecha ISO 8601, p. ej. "2003-05-20T00:00:00.000Z". */
  fecha_nacimiento: string;
  programa: Programa;
  contacto: Contacto;
  estado: EstadoEstudiante;
  /** Ausente si el estudiante aún no tiene fotografía. */
  fotografia?: Fotografia;
}
