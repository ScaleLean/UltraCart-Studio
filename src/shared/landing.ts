import { z } from 'zod';
import { parsePageDocument, safeSectionHref, type CjsonNode } from './page-builder';
import type { DraftReview, Selection, StorePage } from './types';

export const landingBriefSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    path: z
      .string()
      .min(3)
      .max(500)
      .regex(/^\/(?:[A-Za-z0-9_-]+\/)+$/, 'Use a path such as /spring-collection/.'),
    audience: z.string().trim().min(1).max(2000),
    offer: z.string().trim().min(1).max(3000),
    goal: z.string().trim().min(1).max(2000),
    brandConstraints: z.string().trim().max(4000),
  })
  .strict();

export type LandingBrief = z.infer<typeof landingBriefSchema>;
export type LandingProject = {
  id: string;
  workspaceId: string;
  selection: Selection;
  rootId: string;
  brief: LandingBrief;
  sections: CjsonNode[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  origin: 'starter';
  note: string;
};
export type LandingRevision = {
  revision: number;
  at: string;
  note: string;
  sectionCount: number;
  title: string;
};
export type LandingReadiness = {
  parentPath: string;
  parentExists: boolean;
  pathAvailableInCachedCatalog: boolean;
  messages: string[];
};

export type LandingTemplate = {
  name: string;
  pageType: string | null;
  metadataAvailable: boolean;
  system: boolean;
  visualBuilder: boolean | null;
};

export type LandingPreparation = {
  projectId: string;
  workspaceId: string;
  revision: number;
  sourceHash: string;
  contentHash: string;
  selection: Selection;
  preparedAt: string;
  stale: boolean;
  sample: boolean;
  parentPath: string;
  parent: StorePage | null;
  pathAvailable: boolean;
  catalogCheckedAt: string | null;
  themeId: number | null;
  templates: LandingTemplate[];
  groupTemplate: string | null;
  itemTemplate: string | null;
  nativeIds: { status: 'local' | 'reserved'; count: number; receiptId: string | null };
  validation: {
    status: 'passed' | 'failed' | 'unavailable';
    authoredKeys: boolean;
    checkedAt: string | null;
    report: DraftReview['validation'] | null;
    message: string;
  };
  blockers: string[];
  remainingSteps: string[];
  liveVerified: false;
};

export const landingTemplateNameSchema = z
  .string()
  .min(4)
  .max(255)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.vm$/, 'Choose a template file name from the active theme.');

/** Template capability metadata is advisory; it does not prove a body slot is rendered. */
export function parseLandingTemplates(value: unknown, storefrontId: number, themeId: number) {
  const response = z
    .object({
      action: z.literal('sf.pages.templates'),
      storefrontOid: z.literal(storefrontId),
      themeOid: z.literal(themeId),
      templates: z
        .array(
          z.object({
            name: landingTemplateNameSchema,
            page_type: z.string().max(100).nullable().optional(),
            metadata_available: z.boolean().optional(),
            system: z.boolean().optional(),
            visual_builder: z.boolean().optional(),
          })
        )
        .max(2000),
    })
    .parse(value);
  const names = new Set<string>();
  return response.templates.map((template): LandingTemplate => {
    if (names.has(template.name)) throw new Error('The theme returned duplicate template names.');
    names.add(template.name);
    return {
      name: template.name,
      pageType: template.page_type ?? null,
      metadataAvailable: template.metadata_available === true,
      system: template.system === true || template.page_type === 'system',
      visualBuilder: template.visual_builder ?? null,
    };
  });
}

export const landingTargetSchema = z
  .object({
    workspaceId: z.string().min(1).max(100),
    id: z.string().uuid(),
    revision: z.number().int().positive(),
  })
  .strict();

export function landingParentPath(path: string) {
  return path.split('/').slice(0, -2).join('/') + '/';
}

export const safeLandingHref = safeSectionHref;

/** New-page trees use local IDs until the toolkit reserves merchant IDs. */
export function validateLandingSections(value: unknown): CjsonNode[] {
  const encoded = JSON.stringify(value);
  if (!encoded || new TextEncoder().encode(encoded).length > 480 * 1024)
    throw new Error('Keep the landing page below 480 KiB.');
  const sections: unknown = JSON.parse(encoded);
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > 40)
    throw new Error('Use between 1 and 40 sections.');
  const ids = new Set<string>();
  let count = 0;
  const allowed = new Set([
    'section',
    'row',
    'column',
    'flex',
    'container',
    'text',
    'headline',
    'textblock',
    'button',
    'image',
    'spacer',
    'separator',
    'grid',
    'accordion',
    'accordionitem',
  ]);
  function config(value: unknown, key = '') {
    if (key === 'html') {
      if (
        typeof value !== 'string' ||
        (value.match(/<[^>]*>/g) ?? []).some(
          (tag) => !/^<\/?(?:p|h[1-6]|strong|em|ul|ol|li|br)\s*\/?\s*>$/i.test(tag)
        ) ||
        /[<>]/.test(value.replace(/<\/?(?:p|h[1-6]|strong|em|ul|ol|li|br)\s*\/?\s*>/gi, ''))
      )
        throw new Error('Landing text supports simple headings, paragraphs, and lists only.');
    } else if (/script|^on[A-Z]|rawhtml/i.test(key)) {
      throw new Error('Executable content is not supported in landing drafts.');
    } else if (key === 'buttonUrlAction') {
      if (typeof value !== 'string')
        throw new Error('A button destination must be a page path or HTTPS URL.');
      safeLandingHref(value);
    } else if (key === 'buttonAction' && value !== 'URL Action') {
      throw new Error('Landing buttons support URL actions only.');
    } else if (
      ['buttonText', 'accordionItemTitle'].includes(key) &&
      (typeof value !== 'string' || /[<>]/.test(value))
    ) {
      throw new Error('Use plain text for button labels and question titles.');
    }
    if (value && typeof value === 'object')
      for (const [childKey, child] of Object.entries(value)) config(child, childKey);
  }
  function node(input: unknown, depth: number) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 16)
      throw new Error('The native page tree is invalid or nested too deeply.');
    const item = input as Record<string, unknown>;
    if (++count > 500) throw new Error('Use no more than 500 native elements.');
    if (typeof item.id !== 'string' || !/^studio-local-[A-Za-z0-9_-]+$/.test(item.id) || ids.has(item.id))
      throw new Error('Each new native element needs a unique studio-local ID.');
    ids.add(item.id);
    if (typeof item.type !== 'string' || !allowed.has(item.type))
      throw new Error('Use supported native elements for landing pages.');
    if (
      !item.config ||
      typeof item.config !== 'object' ||
      Array.isArray(item.config) ||
      !Array.isArray(item.childWidgets)
    )
      throw new Error('Each native element needs config and childWidgets.');
    for (const ownership of ['ownerType', 'ownerObjectId']) {
      if (ownership in item) throw new Error('New landing pages cannot reuse existing merchant ownership.');
    }
    for (const reference of ['containerId', 'parentWidgetId']) {
      if (
        item[reference] &&
        (typeof item[reference] !== 'string' ||
          !/^studio-local-[A-Za-z0-9_-]+$/.test(item[reference] as string))
      )
        throw new Error('New landing pages cannot reference merchant widget IDs.');
    }
    config(item.config);
    for (const child of item.childWidgets) node(child, depth + 1);
  }
  for (const section of sections) {
    if (!section || typeof section !== 'object' || section.type !== 'section')
      throw new Error('The landing page body must contain native sections.');
    node(section, 0);
  }
  parsePageDocument(
    JSON.stringify(
      { id: 'landing-validation-root', type: 'container', config: {}, childWidgets: sections },
      null,
      2
    )
  );
  return sections as CjsonNode[];
}

export function landingText(value: unknown): string {
  return typeof value === 'string'
    ? value
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
    : '';
}
