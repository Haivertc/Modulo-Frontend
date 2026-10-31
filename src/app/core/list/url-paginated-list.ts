import { Signal, computed, inject, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Observable, Subject, combineLatest, startWith, switchMap } from 'rxjs';

import { PaginatedResponse, SortDirection } from '../../models';
import { GatewayErrorView } from '../http/gateway-error';
import { LOADING, LoadState, toLoadState } from '../http/load-state';

export const PAGE_SIZES: readonly number[] = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

/** Filtros tal como viven en la URL: solo claves con valor, ordenadas alfabéticamente. */
export type Filtros = Record<string, string>;

export interface ListQuery {
  /** Base 1. */
  pageNumber: number;
  pageSize: number;
  sortBy?: string;
  sortDirection: SortDirection;
  filtros: Filtros;
}

export interface UrlPaginatedListConfig<T> {
  /** Campos que el módulo acepta en `sortBy`; cualquier otro valor de la URL se ignora. */
  sortFields: readonly string[];
  /** Nombres de los query params de filtro (los mismos que espera el módulo). */
  filterKeys: readonly string[];
  load: (query: ListQuery) => Observable<PaginatedResponse<T>>;
  notFoundMessage: string;
}

export interface UrlPaginatedList<T> {
  query: Signal<ListQuery>;
  loading: Signal<boolean>;
  error: Signal<GatewayErrorView | null>;
  /** Página visible; conserva la anterior mientras carga la siguiente. */
  page: Signal<PaginatedResponse<T> | null>;
  reload(): void;
  direction(field: string): SortDirection | null;
  sort(field: string): void;
  goTo(pageNumber: number): void;
  setPageSize(pageSize: number): void;
  applyFilters(filtros: Filtros): void;
}

/** Deja solo los filtros con valor, recortados y en orden estable para poder compararlos. */
export function normalizeFiltros(values: Record<string, string | null | undefined>, keys: readonly string[]): Filtros {
  const filtros: Filtros = {};
  for (const key of [...keys].sort()) {
    const value = values[key]?.trim();
    if (value) filtros[key] = value;
  }
  return filtros;
}

/**
 * Listado paginado cuya única fuente de verdad son los query params: página, tamaño, orden y
 * filtros se leen de la URL y cada acción navega. Así funcionan Atrás y los enlaces compartidos.
 * Debe llamarse en un contexto de inyección (inicializador de campo o constructor).
 */
export function urlPaginatedList<T>(config: UrlPaginatedListConfig<T>): UrlPaginatedList<T> {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const reload$ = new Subject<void>();
  const params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const query = computed<ListQuery>(
    () => {
      const p = params();
      const size = Number(p.get('pageSize'));
      const sortBy = p.get('sortBy') ?? undefined;
      const filtros: Record<string, string | null> = {};
      for (const key of config.filterKeys) filtros[key] = p.get(key);
      return {
        pageNumber: Math.max(1, Math.trunc(Number(p.get('pageNumber'))) || 1),
        pageSize: PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
        sortBy: sortBy && config.sortFields.includes(sortBy) ? sortBy : undefined,
        sortDirection: p.get('sortDirection') === 'desc' ? 'desc' : 'asc',
        filtros: normalizeFiltros(filtros, config.filterKeys),
      };
    },
    // Otros query params (o la misma búsqueda) no disparan una nueva petición.
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  const state = toSignal(
    combineLatest([toObservable(query), reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([q]) => toLoadState(config.load(q), config.notFoundMessage)),
    ),
    { initialValue: LOADING as LoadState<PaginatedResponse<T>> },
  );

  const page = linkedSignal<LoadState<PaginatedResponse<T>>, PaginatedResponse<T> | null>({
    source: state,
    computation: (current, previous) => {
      if (current.status === 'ready') return current.data;
      return current.status === 'loading' ? (previous?.value ?? null) : null;
    },
  });

  const navigate = (queryParams: Params) =>
    void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge' });

  return {
    query,
    loading: computed(() => state().status === 'loading'),
    error: computed(() => {
      const current = state();
      return current.status === 'error' ? current.error : null;
    }),
    page,
    reload: () => reload$.next(),
    direction: (field) => (query().sortBy === field ? query().sortDirection : null),
    sort: (field) => {
      const { sortBy, sortDirection } = query();
      const next: SortDirection = sortBy === field && sortDirection === 'asc' ? 'desc' : 'asc';
      navigate({ sortBy: field, sortDirection: next, pageNumber: null });
    },
    goTo: (pageNumber) => navigate({ pageNumber: pageNumber > 1 ? pageNumber : null }),
    setPageSize: (pageSize) => navigate({ pageSize, pageNumber: null }),
    applyFilters: (filtros) => {
      // Cambiar un filtro vuelve a la primera página; los filtros vacíos salen de la URL.
      const queryParams: Params = { pageNumber: null };
      for (const key of config.filterKeys) queryParams[key] = filtros[key] ?? null;
      navigate(queryParams);
    },
  };
}
