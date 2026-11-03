import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { NotificationService } from '../feedback/notification.service';
import { AuthService } from './auth.service';

/**
 * Protege las rutas de creación y edición (`.../nuevo`, `.../:id/editar`): solo ADMIN entra.
 * Un ESTUDIANTE que llegue por URL vuelve al listado de la sección con un aviso.
 * Es una ayuda de interfaz: el Gateway rechaza igualmente (403) cualquier escritura.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).esAdmin()) {
    return true;
  }
  inject(NotificationService).error(
    'Acceso denegado',
    'Tu rol solo permite consultar la información; no puedes crear ni editar registros.',
  );
  // "/materias/3/editar?x=1" -> "/materias"
  const seccion = state.url.split(/[/?#]/)[1] ?? '';
  return inject(Router).createUrlTree([`/${seccion}`]);
};
