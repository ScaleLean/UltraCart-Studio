import { z } from 'zod';
import { draftScopeSchema, type DraftScope } from './drafts';
import { assertPagePath } from './storefront';

const filePath = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      return assertPagePath(value) === value;
    } catch {
      return false;
    }
  }, 'Invalid storefront file path');
const sourceSchema = z.object({
  file: filePath,
  kind: z.enum(['theme container', 'page container']),
  reached: z.literal(true),
  via: z.array(z.string().max(4096)).max(80),
});
const mapSchema = z.object({
  action: z.literal('sf.locate'),
  storefrontOid: z.number().int().positive(),
  page: filePath,
  themeOid: z.number().int().positive(),
  themePath: filePath,
  template: filePath,
  containers: z.array(sourceSchema).max(500),
  warnings: z.array(z.string().max(8000)).max(200),
  notFollowed: z.array(z.string().max(8000)).max(500),
  searchedTheme: z.literal(false),
});
export type ContentSource = z.infer<typeof sourceSchema> & { slot: string | null };
export type ContentMap = {
  page: string;
  themeId: number;
  template: string;
  sources: ContentSource[];
  warnings: string[];
  notFollowed: string[];
  checkedAt: string;
  sample: boolean;
};

export function parseContentMap(value: unknown, scope: DraftScope): ContentMap {
  const data = mapSchema.parse(value);
  if (data.storefrontOid !== scope.selection.storefront.id || data.page !== scope.path)
    throw new Error('The content map belongs to another storefront or page.');
  if (!data.themePath.startsWith('/themes/') || !data.template.startsWith('/themes/'))
    throw new Error('The content map has an unexpected theme path.');
  const prefix = scope.path.endsWith('/') ? scope.path : `${scope.path}/`;
  const seen = new Set<string>();
  const sources = data.containers.map((source): ContentSource => {
    if (seen.has(source.file)) throw new Error('The content map contains duplicate files.');
    seen.add(source.file);
    let slot: string | null = null;
    if (source.kind === 'page container') {
      if (!source.file.startsWith(prefix) || !source.file.endsWith('.cjson'))
        throw new Error('A content map container belongs to another page.');
      slot = draftScopeSchema.shape.slot.parse(source.file.slice(prefix.length, -6));
      if (source.file !== `${prefix}${slot}.cjson`)
        throw new Error('A content map slot has an unexpected path.');
    } else if (!source.file.startsWith('/themes/') || !source.file.endsWith('.cjson')) {
      throw new Error('The content map has an unexpected shared container.');
    }
    return { ...source, slot };
  });
  return {
    page: data.page,
    themeId: data.themeOid,
    template: data.template,
    sources,
    warnings: data.warnings,
    notFollowed: data.notFollowed,
    checkedAt: new Date().toISOString(),
    sample: false,
  };
}
