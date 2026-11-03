import type { Rol } from '../app/core/auth/auth.service';

const STORAGE_KEY = 'gestion-academica.auth.token';

const base64url = (texto: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** JWT con el formato del módulo de Autenticación ({ id, usuario, rol, exp }); la firma no se valida en el cliente. */
export function tokenDePrueba(rol: Rol | string | null, { vencido = false } = {}): string {
  const exp = Math.floor(Date.now() / 1000) + (vencido ? -60 : 3600);
  const payload = { id: 1, usuario: 'prueba', ...(rol !== null && { rol }), exp };
  return `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(JSON.stringify(payload))}.firma`;
}

/** Deja una sesión guardada antes de crear el TestBed (AuthService la lee al construirse). */
export function iniciarSesionComo(rol: Rol): void {
  localStorage.setItem(STORAGE_KEY, tokenDePrueba(rol));
}

export function cerrarSesion(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** jsdom no permite asignar `input.files`: se define y se dispara `change`, como al elegir un archivo. */
export function elegirArchivo(input: HTMLInputElement, archivo: File): void {
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  input.dispatchEvent(new Event('change'));
}

/** Archivo de `bytes` bytes cuyo contenido empieza con `cabecera` (p. ej. "%PDF-"). */
export function archivoDePrueba(nombre: string, tipo: string, bytes: number, cabecera = ''): File {
  const contenido = new Uint8Array(bytes);
  contenido.set(new TextEncoder().encode(cabecera).slice(0, bytes));
  return new File([contenido], nombre, { type: tipo });
}
