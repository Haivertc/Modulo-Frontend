/** Archivo PDF de contenido temático de una materia (módulo Materias, almacenado en AWS S3). */
export interface ContenidoTematico {
  id: number;
  materiaId: number;
  claveS3: string;
  nombreOriginal: string;
  tipoMime: string;
  tamanoBytes: number;
  /** URL firmada temporal (1 hora) que descarga el archivo con su nombre original. */
  url: string;
}
