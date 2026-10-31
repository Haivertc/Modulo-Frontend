import { effect, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Observable, debounceTime, filter, map } from 'rxjs';

import { Filtros, UrlPaginatedList, normalizeFiltros } from './url-paginated-list';

const DEBOUNCE_MS = 350;

/** Lo que se necesita de un `FormGroup` de filtros (todos sus controles son de texto). */
interface FilterForm {
  readonly controls: Record<string, FormControl<string>>;
  readonly valueChanges: Observable<unknown>;
  readonly valid: boolean;
}

/**
 * Sincroniza un formulario de filtros con la URL en ambos sentidos:
 * - lo que se escribe se aplica solo (con una pausa corta) y queda en los query params;
 * - si la URL cambia desde fuera (Atrás, un enlace compartido) el formulario se actualiza.
 * Debe llamarse en un contexto de inyección.
 */
export function syncFilterForm(
  form: FilterForm,
  list: Pick<UrlPaginatedList<unknown>, 'query' | 'applyFilters'>,
): void {
  const keys = Object.keys(form.controls);
  const fill = (filtros: Filtros) => {
    for (const key of keys) form.controls[key].setValue(filtros[key] ?? '', { emitEvent: false });
  };
  const read = () => Object.fromEntries(keys.map((key) => [key, form.controls[key].value]));
  // Último valor enviado a la URL: distingue los cambios propios de los externos.
  let applied = JSON.stringify(list.query().filtros);

  fill(list.query().filtros);

  effect(() => {
    const filtros = list.query().filtros;
    const json = JSON.stringify(filtros);
    if (json === applied) return;
    applied = json;
    untracked(() => fill(filtros));
  });

  form.valueChanges
    .pipe(
      debounceTime(DEBOUNCE_MS),
      filter(() => form.valid),
      map(() => normalizeFiltros(read(), keys)),
      filter((filtros) => JSON.stringify(filtros) !== applied),
      takeUntilDestroyed(),
    )
    .subscribe((filtros) => {
      applied = JSON.stringify(filtros);
      list.applyFilters(filtros);
    });
}
