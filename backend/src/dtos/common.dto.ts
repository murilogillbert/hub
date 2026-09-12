export function envelope<T>(data: T): { data: T } {
  return { data };
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function toPage<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  return { items, total, page, pageSize, totalPages };
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/** Item nomeado com valor (R$) e quantidade — categorias, métodos, produtos, leads. */
export interface NamedValue {
  name: string;
  value: number;
  count: number;
}
