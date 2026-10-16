import { Knex } from 'knex';

export interface IPaginationParams {
  cursor?: string;
  limit: number;
  orderBy: string;
  sortBy: 'asc' | 'desc';
}

export interface IFilterParams {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'lte' | 'gte' | 'in' | 'like';
  value: string | string[];
}

export interface IPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLocaleLowerCase()}`);
}

export function applyCursorPagination(
  query: Knex.QueryBuilder,
  params: IPaginationParams,
  tablePrefix?: string,
): Knex.QueryBuilder {
  let column = params.orderBy;
  let direction = params.sortBy;

  // Handle if column was passed in sortBy and direction in orderBy
  if (direction !== 'asc' && direction !== 'desc') {
    const temp = column;
    column = direction;
    direction = (temp === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  }

  if (!column) {
    column = 'createdAt';
  }

  const dbColumn = camelToSnake(column);
  const fullColumn = tablePrefix && !dbColumn.includes('.') ? `${tablePrefix}.${dbColumn}` : dbColumn;

  if (params.cursor) {
    const op = direction === 'asc' ? '>' : '<';
    query = query.where(fullColumn, op, params.cursor);
  }

  return query.orderBy(fullColumn, direction || 'asc').limit(params.limit + 1);
}

export function applyFilters(query: Knex.QueryBuilder, filters: IFilterParams[], tablePrefix?: string): Knex.QueryBuilder {
  for (const filter of filters) {
    const dbColumn = camelToSnake(filter.field);
    const fullField = tablePrefix && !dbColumn.includes('.') ? `${tablePrefix}.${dbColumn}` : dbColumn;
    switch (filter.operator) {
      case 'eq':
        query.where(fullField, filter.value);
        break;
      case 'gt':
        query.where(fullField, '>', filter.value);
        break;
      case 'lt':
        query.where(fullField, '<', filter.value);
        break;
      case 'lte':
        query.where(fullField, '<=', filter.value);
        break;
      case 'gte':
        query.where(fullField, '>=', filter.value);
        break;
      case 'like':
        query.whereLike(fullField, `%${filter.value}%`);
        break;
      case 'in':
        query.whereIn(fullField, Array.isArray(filter.value) ? filter.value : [filter.value]);
        break;
    }
  }

  return query;
}

export function buildPaginationResult<T>(rows: T[], limit: number, sortBy: string) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  let nextCursor = null;

  if (data.length > 0) {
    const lastItem = data[data.length - 1] as any;
    nextCursor = hasMore && lastItem ? String(lastItem[sortBy] ?? lastItem['id'] ?? '') : null;
  }

  return {
    data,
    meta: {
      nextCursor: nextCursor,
      hasMore: hasMore,
      count: data.length,
    },
  };
}
