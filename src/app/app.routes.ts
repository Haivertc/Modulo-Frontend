import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/role.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

// Cada formulario atiende la creación (`.../nuevo`) y la edición (`.../:id/editar`); solo ADMIN entra (adminGuard).
const estudianteForm = () =>
  import('./features/estudiantes/formulario/estudiante-form.component').then((m) => m.EstudianteFormComponent);
const materiaForm = () =>
  import('./features/materias/formulario/materia-form.component').then((m) => m.MateriaFormComponent);
const inscripcionForm = () =>
  import('./features/inscripciones/formulario/inscripcion-form.component').then((m) => m.InscripcionFormComponent);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  // La raíz siempre abre el login; tras iniciar sesión se navega a /estudiantes (o a returnUrl).
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    // Todas las vistas protegidas se renderizan dentro del layout principal. Sin sesión
    // vigente, authGuard envía al login recordando la URL pedida (returnUrl).
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: 'estudiantes',
        title: 'Estudiantes',
        loadComponent: () =>
          import('./features/estudiantes/listado/estudiantes-list.component').then((m) => m.EstudiantesListComponent),
      },
      // `nuevo` va antes de `:id` para que no se interprete como un ID.
      { path: 'estudiantes/nuevo', title: 'Nuevo estudiante', canActivate: [adminGuard], loadComponent: estudianteForm },
      { path: 'estudiantes/:id/editar', title: 'Editar estudiante', canActivate: [adminGuard], loadComponent: estudianteForm },
      {
        path: 'estudiantes/:id',
        title: 'Detalle del estudiante',
        loadComponent: () =>
          import('./features/estudiantes/detalle/estudiante-detalle.component').then(
            (m) => m.EstudianteDetalleComponent,
          ),
      },
      {
        path: 'materias',
        title: 'Materias',
        loadComponent: () =>
          import('./features/materias/listado/materias-list.component').then((m) => m.MateriasListComponent),
      },
      { path: 'materias/nuevo', title: 'Nueva materia', canActivate: [adminGuard], loadComponent: materiaForm },
      { path: 'materias/:id/editar', title: 'Editar materia', canActivate: [adminGuard], loadComponent: materiaForm },
      {
        path: 'inscripciones',
        title: 'Inscripciones',
        loadComponent: () =>
          import('./features/inscripciones/listado/inscripciones-list.component').then(
            (m) => m.InscripcionesListComponent,
          ),
      },
      { path: 'inscripciones/nuevo', title: 'Nueva inscripción', canActivate: [adminGuard], loadComponent: inscripcionForm },
      { path: 'inscripciones/:id/editar', title: 'Editar inscripción', canActivate: [adminGuard], loadComponent: inscripcionForm },
    ],
  },
  // URL desconocida: al listado de estudiantes (authGuard lleva al login si no hay sesión)
  { path: '**', redirectTo: 'estudiantes' },
];
