import type { Workspace, StorePage, Selection } from './types';

export const sampleWorkspace: Workspace = {
  id: 'sample',
  kind: 'sample',
  label: 'Fieldwork',
  selection: {
    profileId: 'studio-sample',
    merchantId: 'SAMPLE',
    storefront: { id: 1, host: 'fieldwork.example', themeId: 1 },
    verifiedAt: '2026-01-01T00:00:00.000Z',
  },
};
export const samplePages: StorePage[] = [
  ['/', 'Home', 'homepage.vm', 3, 0],
  ['/shop/', 'Shop all', 'collection.vm', 3, 3],
  ['/shop/daily-cleanser/', 'Daily Cleanser', 'product.vm', 0, 1],
  ['/shop/face-oil/', 'Botanical Face Oil', 'product.vm', 0, 1],
  ['/shop/body-wash/', 'Everyday Body Wash', 'product.vm', 0, 1],
  ['/our-story/', 'Our story', 'page.vm', 0, 0],
  ['/journal/', 'Field notes', 'journal.vm', 1, 0],
  ['/journal/a-simpler-routine/', 'A simpler routine', 'article.vm', 0, 0],
].map(([path, title, template, children, items]) => ({
  path: String(path),
  title: String(title),
  template: String(template),
  children: Number(children),
  items: Number(items),
  parent: String(path) === '/' ? '' : String(path).split('/').slice(0, -2).join('/') + '/',
  description: 'A sample storefront for exploring UltraCart Studio.',
  itemTemplate: null,
  visible: true,
  search: 'indexable',
  type: Number(items) === 1 ? 'product' : 'page',
  catalogCopies: 1,
}));
export function sampleBody(path: string) {
  const page = samplePages.find((p) => p.path === path);
  const home = path === '/';
  return JSON.stringify(
    {
      id: 'page-body',
      type: 'container',
      config: {},
      childWidgets: [
        {
          id: 'eyebrow',
          type: 'text',
          config: { text: home ? 'LESS, BUT BETTER.' : 'THE FIELDWORK COLLECTION' },
        },
        {
          id: 'headline',
          type: 'text',
          config: { text: home ? 'Good things.\nSimple rituals.' : page?.title || 'Our story' },
        },
        {
          id: 'description',
          type: 'text',
          config: {
            text: home
              ? 'Thoughtfully made essentials for the everyday. A little closer to nature. A little more like you.'
              : 'Considered ingredients. Everyday care. Discover a simpler way to feel at home in your skin.',
          },
        },
        {
          id: 'cta',
          type: 'button',
          config: { label: home ? 'Find your everyday' : 'Explore the collection' },
        },
        { id: 'collection-title', type: 'text', config: { text: 'Your daily essentials' } },
        { id: 'announcement', type: 'text', config: { text: 'A fresh start for your everyday.' } },
      ],
    },
    null,
    2
  );
}

export function isSampleSelection(selection: Selection) {
  const sample = sampleWorkspace.selection;
  return (
    selection.profileId === sample.profileId &&
    selection.merchantId === sample.merchantId &&
    selection.storefront.id === sample.storefront.id &&
    selection.storefront.host === sample.storefront.host
  );
}
