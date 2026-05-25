import { lazy, type LazyExoticComponent } from 'react';

type LazyImporter = Parameters<typeof lazy>[0];
type LazyLoadableComponent = Awaited<ReturnType<LazyImporter>>['default'];

export const loadNamedComponent = async <
  TExportName extends string,
  TModule extends Record<TExportName, LazyLoadableComponent>,
>(
  importer: () => Promise<TModule>,
  exportName: TExportName,
): Promise<{ default: TModule[TExportName] }> => {
  const module = await importer();
  return { default: module[exportName] };
};

export const lazyNamedComponent = <
  TExportName extends string,
  TModule extends Record<TExportName, LazyLoadableComponent>,
>(
  importer: () => Promise<TModule>,
  exportName: TExportName,
): LazyExoticComponent<TModule[TExportName]> => lazy(() => loadNamedComponent(importer, exportName));
