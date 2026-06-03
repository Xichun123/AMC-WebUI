export type UpdaterOrValue<T> = T | ((previous: T) => T);

export const resolveUpdaterOrValue = <T>(value: UpdaterOrValue<T>, previous: T): T =>
  typeof value === 'function' ? (value as (previous: T) => T)(previous) : value;
