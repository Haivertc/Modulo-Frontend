/** Filtros que acepta `GET /api/estudiantes`. */
export interface EstudiantesFiltros {
  /** Búsqueda parcial en nombre, apellido o correo. */
  search?: string;
  /** `_id` del programa (coincidencia exacta). */
  programa?: string;
  ciudad?: string;
}

/** Filtros que acepta `GET /api/materias`. */
export interface MateriasFiltros {
  /** Coincidencia parcial, sin distinguir mayúsculas. */
  nombre?: string;
  /** Coincidencia exacta. */
  creditos?: number;
  /** Nombre del programa (texto parcial); en Materias el programa no es una referencia por ID. */
  programa?: string;
}

/** Filtros que acepta `GET /api/inscripciones` (todos por coincidencia exacta). */
export interface InscripcionesFiltros {
  periodo?: string;
  estudianteId?: string;
  cursoId?: string;
}
