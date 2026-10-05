import type { StorePage } from '../../shared/types';

export type CatalogRow = { page: StorePage; depth: number; hasChildren: boolean };
export function pageAncestors(path: string, known: Set<string>): string[] {
  const ancestors: string[] = [];
  const segments = path.split('/').filter(Boolean);
  for (let length = 1; length < segments.length; length++) {
    const parent = '/' + segments.slice(0, length).join('/') + '/';
    if (known.has(parent)) ancestors.push(parent);
  }
  return ancestors;
}
export function catalogRows(pages: StorePage[], query: string, expanded: Set<string>): CatalogRow[] {
  const known = new Set(pages.map((page) => page.path));
  const parents = new Set(pages.flatMap((page) => pageAncestors(page.path, known)));
  const term = query.trim().toLowerCase();
  return [...pages]
    .sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)))
    .flatMap((page) => {
      const ancestors = pageAncestors(page.path, known);
      const matches = term
        ? `${page.title} ${page.path} ${page.template || ''}`.toLowerCase().includes(term)
        : ancestors.every((path) => expanded.has(path));
      return matches
        ? [{ page, depth: term ? 0 : Math.min(ancestors.length, 4), hasChildren: parents.has(page.path) }]
        : [];
    });
}
