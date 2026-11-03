/** Formato aceptado: el tipo MIME que declara el navegador y sus extensiones válidas. */
export interface TipoArchivo {
  mime: string;
  extensiones: readonly string[];
  /** Nombre para los mensajes, p. ej. "JPG". */
  etiqueta: string;
}

const MB = 1024 * 1024;

/** Mismas reglas que valida el módulo Estudiantes en POST /api/estudiantes/{id}/fotografia. */
export const FORMATOS_FOTOGRAFIA: readonly TipoArchivo[] = [
  { mime: 'image/jpeg', extensiones: ['.jpg', '.jpeg'], etiqueta: 'JPG' },
  { mime: 'image/png', extensiones: ['.png'], etiqueta: 'PNG' },
];
export const MAX_BYTES_FOTOGRAFIA = 2 * MB;

/** Mismas reglas que valida el módulo Materias en POST /api/materias/{id}/contenido-tematico. */
export const FORMATOS_PDF: readonly TipoArchivo[] = [
  { mime: 'application/pdf', extensiones: ['.pdf'], etiqueta: 'PDF' },
];
export const MAX_BYTES_PDF = 10 * MB;
