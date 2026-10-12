import { IFilterParams, IPaginationParams } from './cursor-pagination';

const DEFAULT_SORT_BY = 'createdAt';

export function parsePagination(
  query: Record<string, any>,
  allowedSortBy: string[] = ['createdAt'],
): IPaginationParams {
  const sortBy = allowedSortBy.includes(query.sortBy) ? query.sortBy : DEFAULT_SORT_BY;

  return {
    cursor: query.cursor,
    limit: Number.isNaN(Number(query.limit)) ? 200 : Math.min(200, Number(query.limit)),
    sortBy,
    orderBy: query.sortBy === 'desc' ? 'desc' : 'asc',
  };
}

export function parseFilters(query: Record<string, any>, allowedFields: string[]): IFilterParams[] {
  const filter = query.filter;
  if (!filter || typeof filter !== 'object') {
    return [];
  }

  const allowedOps = new Set(['eq', 'gt', 'lt', 'gte', 'lte', 'like', 'in']);

  return allowedFields.flatMap((field) => {
    const fieldFilters = filter[field];
    if (!fieldFilters || typeof fieldFilters !== 'object') {
      return [];
    }

    return Object.entries(fieldFilters)
      .filter(([op]) => allowedOps.has(op))
      .map(([operator, value]) => ({
        field: field,
        operator: operator as IFilterParams['operator'],
        value: value as string | string[],
      }));
  });
}
