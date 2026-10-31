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

/** Lee `exp` del payload del JWT. La firma la valida el Gateway, no el cliente. */
function isExpired(token: string): boolean {
  try {
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
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
