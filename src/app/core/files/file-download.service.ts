import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Inicia la descarga de un archivo a partir de una URL firmada de S3.
 *
 * La URL ya trae `Content-Disposition: attachment`, así que navegar a ella en la misma
 * pestaña descarga el archivo sin salir de la aplicación. Se usa un enlace temporal en
 * lugar de `window.open`: tras una petición asíncrona, el navegador bloquearía la
 * ventana emergente.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private readonly document = inject(DOCUMENT);

  download(url: string): void {
    const link = this.document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    link.style.display = 'none';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
