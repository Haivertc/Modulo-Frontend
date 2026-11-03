import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';

const STORAGE_KEY = 'gestion-academica.auth.token';

/** Respuesta de `POST /api/auth/login` del Gateway. */
interface LoginResponse {
  token: string;
}

/** Sesión basada en el JWT que emite el API Gateway. El token se guarda en localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = `${inject(APP_CONFIG).apiBaseUrl}/auth/login`;
  private readonly tokenState = signal<string | null>(readStoredToken());

  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const token = this.tokenState();
    return token !== null && !isExpired(token);
  });

  /** Claim `rol` del JWT (`ADMIN` o `ESTUDIANTE`), o `null` sin sesión vigente. */
  readonly rol = computed<Rol | null>(() => {
    const token = this.tokenState();
    if (token === null || !this.isAuthenticated()) return null;
    const rol = decodePayload(token)?.['rol'];
    return rol === 'ADMIN' || rol === 'ESTUDIANTE' ? rol : null;
  });

  /**
   * Solo ADMIN crea, edita, elimina y sube archivos (igual que la política RBAC del Gateway).
   * Un rol ausente o desconocido se trata como sin permisos de escritura.
   */
  readonly esAdmin = computed(() => this.rol() === 'ADMIN');

  /** Es la URL que el interceptor excluye al adjuntar el token y al manejar 401. */
  isLoginRequest(url: string): boolean {
    return url.startsWith(this.loginUrl);
  }

  login(usuario: string, clave: string): Observable<void> {
    return this.http.post<LoginResponse>(this.loginUrl, { usuario, clave }).pipe(
      tap(({ token }) => {
        writeStoredToken(token);
        this.tokenState.set(token);
      }),
      map(() => undefined),
    );
  }

  logout(): void {
    writeStoredToken(null);
    this.tokenState.set(null);
  }
}

/** Roles que emite el módulo de Autenticación en el claim `rol`. */
export type Rol = 'ADMIN' | 'ESTUDIANTE';

/**
 * Payload del JWT (base64url). Solo se lee para adaptar la interfaz: la firma la valida
 * el Gateway, que es quien realmente aplica los permisos.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '='));
    // atob devuelve bytes: se decodifican como UTF-8 por si el payload trae tildes
    const payload: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Lee `exp` del payload del JWT. */
function isExpired(token: string): boolean {
  const payload = decodePayload(token);
  if (payload === null) return true;
  return typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now();
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    // Sin acceso a localStorage la sesión vive solo en memoria.
  }
}
