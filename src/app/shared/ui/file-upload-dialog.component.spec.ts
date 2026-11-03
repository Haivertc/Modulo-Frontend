import { FORMATOS_FOTOGRAFIA, FORMATOS_PDF, MAX_BYTES_FOTOGRAFIA, MAX_BYTES_PDF } from '../../core/files/formatos';
import { archivoDePrueba } from '../../../testing/session';
import { validarArchivo } from './file-upload-dialog.component';

describe('validarArchivo', () => {
  const foto = (nombre: string, tipo: string, bytes = 1024) =>
    validarArchivo(archivoDePrueba(nombre, tipo, bytes), FORMATOS_FOTOGRAFIA, MAX_BYTES_FOTOGRAFIA);

  it('acepta JPG (.jpg y .jpeg) y PNG', () => {
    expect(foto('carne.jpg', 'image/jpeg')).toBeNull();
    expect(foto('CARNE.JPEG', 'image/jpeg')).toBeNull();
    expect(foto('carne.png', 'image/png')).toBeNull();
  });

  it('rechaza otros formatos y extensiones que no coinciden con el tipo MIME', () => {
    const motivo = 'Formato no permitido. Solo se aceptan archivos JPG o PNG.';
    expect(foto('animada.gif', 'image/gif')).toBe(motivo);
    expect(foto('foto.png', 'image/jpeg')).toBe(motivo);
    expect(foto('documento.jpg', 'application/pdf')).toBe(motivo);
    expect(foto('sin-extension', 'image/png')).toBe(motivo);
  });

  it('respeta el máximo de 2 MB (incluido el límite exacto)', () => {
    expect(foto('limite.jpg', 'image/jpeg', MAX_BYTES_FOTOGRAFIA)).toBeNull();
    expect(foto('grande.jpg', 'image/jpeg', MAX_BYTES_FOTOGRAFIA + 1)).toBe(
      'El archivo pesa 2,01 MB; el máximo permitido es 2 MB.',
    );
    expect(foto('grande.jpg', 'image/jpeg', 3.5 * 1024 * 1024)).toBe(
      'El archivo pesa 3,5 MB; el máximo permitido es 2 MB.',
    );
  });

  it('rechaza archivos vacíos', () => {
    expect(foto('vacia.png', 'image/png', 0)).toBe('El archivo está vacío.');
  });

  it('PDF: solo application/pdf y hasta 10 MB', () => {
    const pdf = (nombre: string, tipo: string, bytes: number) =>
      validarArchivo(archivoDePrueba(nombre, tipo, bytes), FORMATOS_PDF, MAX_BYTES_PDF);
    expect(pdf('programa.pdf', 'application/pdf', MAX_BYTES_PDF)).toBeNull();
    expect(pdf('programa.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10)).toBe(
      'Formato no permitido. Solo se aceptan archivos PDF.',
    );
    expect(pdf('programa.pdf', 'application/pdf', MAX_BYTES_PDF + 1)).toContain('el máximo permitido es 10 MB');
  });
});
