import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRows } from '../src/renderer/lib/catalog';
import { samplePages } from '../src/shared/sample';

test('catalog branches collapse while search still finds every descendant', () => {
  const collapsed = catalogRows(samplePages, '', new Set()).map((row) => row.page.path);
  assert(collapsed.includes('/shop/'));
  assert(!collapsed.includes('/shop/face-oil/'));
  const expanded = catalogRows(samplePages, '', new Set(['/shop/']));
  assert(expanded.some((row) => row.page.path === '/shop/face-oil/' && row.depth === 1));
  assert.equal(catalogRows(samplePages, 'face-oil', new Set())[0].page.path, '/shop/face-oil/');
  assert.equal(catalogRows(samplePages, 'product.vm', new Set()).length, 3);
});
