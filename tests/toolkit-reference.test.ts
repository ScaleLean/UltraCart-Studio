import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchToolkitCommands,
  resolveToolkitSkillLink,
  toolkitCommandChildren,
  toolkitCommands,
  toolkitCommandUsage,
  toolkitGuides,
  TOOLKIT_REFERENCE_VERSION,
} from '../src/shared/toolkit-reference';

function command(path: string) {
  const result = toolkitCommands.find((item) => item.path === path);
  assert.ok(result, `Missing command: ${path}`);
  return result;
}

test('the documented version has a complete, reachable command hierarchy and authored inputs', () => {
  assert.equal(TOOLKIT_REFERENCE_VERSION, '0.1.0-preview.11');
  assert.equal(toolkitCommands.length, 193);
  assert.equal(toolkitCommands.filter((item) => !item.group).length, 155);
  assert.equal(
    toolkitCommands.reduce((total, item) => total + item.options.length, 0),
    512
  );
  assert.equal(new Set(toolkitCommands.map((item) => item.id)).size, toolkitCommands.length);
  const visited = new Set<string>();
  const visit = (id: string) => {
    assert.equal(visited.has(id), false, `Duplicate or cyclic hierarchy at ${id}`);
    visited.add(id);
    for (const child of toolkitCommandChildren(id)) visit(child.id);
  };
  visit('cli');
  assert.equal(visited.size, toolkitCommands.length);
  for (const item of toolkitCommands) {
    assert.ok(item.summary.length > 15, `Missing authored summary for ${item.path}`);
    for (const input of [...item.arguments, ...item.options]) {
      assert.ok(input.description.length > 15, `${item.path}: ${input.syntax}`);
      assert.doesNotMatch(input.description, /See this command’s installed|Value for this positional/);
    }
    assert.equal(item.group, toolkitCommandChildren(item.id).length > 0, item.path);
    if (!item.group) assert.ok(item.risks.length > 0, `Unclassified effect: ${item.path}`);
  }
});

test('required options, parser defaults, variadic values and legacy aliases retain their contract', () => {
  const pull = command('sf pull');
  assert.deepEqual(
    pull.options.filter((item) => item.required).map((item) => item.syntax),
    ['--storefront <oid>', '--out <file>']
  );
  assert.match(toolkitCommandUsage(pull), /sf pull <path> --storefront <oid> --out <file>/);
  assert.equal(
    command('sf ids').options.find((item) => item.syntax === '--count <number>')?.defaultValue,
    '1'
  );
  assert.deepEqual(command('').options.find((item) => item.syntax === '--format <format>')?.choices, [
    'text',
    'json',
  ]);
  assert.equal(command('profile show').arguments[0].required, false);
  assert.equal(command('sf pages items remove').arguments[0].syntax, '<itemIds...>');
  assert.deepEqual(command('update').options, command('cjson update').options);
  assert.match(command('update').notes.join(' '), /Legacy root alias/);
  assert.notEqual(command('init').summary, command('cjson init').summary);
});

test('remote mutation and authentication effects do not depend on a live flag', () => {
  for (const path of ['sf containers push', 'sf containers revert', 'sf pages refresh']) {
    assert.ok(command(path).risks.includes('live-write'), path);
    assert.equal(
      command(path).options.some((item) => item.syntax === '--live'),
      false,
      path
    );
    assert.equal(command(path).network, true);
  }
  assert.ok(command('sf containers push').risks.includes('allocation'));
  assert.ok(command('sf ids').risks.includes('allocation'));
  for (const path of ['auth login', 'auth logout', 'profile remove']) {
    assert.ok(command(path).risks.includes('auth'), path);
    assert.ok(command(path).risks.includes('local-write'), path);
    assert.equal(command(path).network, true);
  }
  assert.ok(command('warehouse query').risks.includes('query'));
  assert.match(command('warehouse query').notes.join(' '), /Execution is the default/);
});

test('local authoring, remote reads, previews, and file outputs have distinct effects', () => {
  assert.deepEqual(command('cjson update').risks, ['local-write']);
  assert.equal(command('cjson update').network, false);
  assert.deepEqual(command('sf surveys validate').risks, ['read']);
  assert.equal(command('sf surveys validate').network, false);
  assert.deepEqual(command('sf elements get').risks, ['read']);
  assert.equal(command('sf elements get').network, true);
  assert.deepEqual(command('sf pull').risks, ['read', 'local-write']);
  assert.deepEqual(command('sf recordings render').risks, ['read', 'local-write']);
  assert.deepEqual(command('sf preview stage').risks, ['preview']);
  assert.match(command('sf preview stage').notes.join(' '), /entire staged set/);
  assert.deepEqual(command('recipe instantiate').risks, ['read']);
  assert.match(
    command('recipe instantiate').notes.join(' '),
    /does not change the CJSON file or reserve IDs/
  );
});

test('search finds descriptions and flags, applies every term, and narrows effects', () => {
  assert.ok(searchToolkitCommands('preview entire').some((item) => item.path === 'sf preview stage'));
  assert.ok(searchToolkitCommands('  --remap-ids   ').some((item) => item.path === 'sf containers push'));
  assert.equal(searchToolkitCommands('preview entire', 'live-write').length, 0);
  assert.equal(searchToolkitCommands('sf ids', 'allocation')[0].path, 'sf ids');
  assert.ok(searchToolkitCommands('sf ids', 'allocation').every((item) => item.risks.includes('allocation')));
  assert.ok(searchToolkitCommands('merchant item').some((item) => item.path === 'sf items get'));
  assert.equal(searchToolkitCommands('not-a-command-at-all').length, 0);
});

test('known command paths rank above incidental prose and allow a CLI prefix', () => {
  assert.equal(searchToolkitCommands('warehouse query')[0].path, 'warehouse query');
  assert.equal(searchToolkitCommands('UC-STOREFRONT   sf   pull')[0].path, 'sf pull');
  assert.equal(searchToolkitCommands('sf pages')[0].path, 'sf pages');
  const results = searchToolkitCommands('preview');
  const pathMatches = results.filter((item) => item.path.includes('preview'));
  assert.deepEqual(results.slice(0, pathMatches.length), pathMatches);
});

test('all capability links resolve and the reference describes only the toolkit', () => {
  assert.equal(new Set(toolkitGuides.map((guide) => guide.id)).size, toolkitGuides.length);
  assert.equal(toolkitGuides.length, 10);
  for (const guide of toolkitGuides) {
    assert.ok(guide.sections.length >= 3, guide.id);
    for (const section of guide.sections) for (const path of section.commands || []) command(path);
  }
  const warehouse = toolkitGuides.find((guide) => guide.id === 'warehouse')!;
  const warehouseText = warehouse.sections.flatMap((section) => section.paragraphs).join(' ');
  assert.match(warehouseText, /executes after those checks by default/);
  assert.match(warehouseText, /default scan ceiling is 20GiB/);
  assert.doesNotMatch(
    JSON.stringify({ commands: toolkitCommands, guides: toolkitGuides }),
    /Studio|ChatGPT|Pi Durable|Electron|Bootstrap/
  );
  assert.ok(toolkitGuides.find((guide) => guide.id === 'skills'));
  assert.ok(warehouse.sections.find((section) => section.code)?.code?.endsWith('--dry-run'));
});

test('skill links resolve only to indexed documents inside the selected skill', () => {
  const files = [
    { id: 'entry', path: 'SKILL.md' },
    { id: 'intro', path: 'references/start.md' },
    { id: 'nested', path: 'references/detail/safe.md' },
    { id: 'space', path: 'references/a file.md' },
  ];
  assert.equal(resolveToolkitSkillLink('SKILL.md', 'references/start.md#section', files), 'intro');
  assert.equal(resolveToolkitSkillLink('references/start.md', '../SKILL.md', files), 'entry');
  assert.equal(resolveToolkitSkillLink('references/start.md', './detail/safe.md', files), 'nested');
  assert.equal(resolveToolkitSkillLink('SKILL.md', 'references/a%20file.md', files), 'space');
  for (const href of [
    'https://example.com/references/start.md',
    '//example.com/SKILL.md',
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///private/SKILL.md',
    'https%3A%2F%2Fexample.com',
    '/SKILL.md',
    '../SKILL.md',
    '%2e%2e/SKILL.md',
    'references/../../SKILL.md',
    'references\\start.md',
    'references/%5cstart.md',
    'references/missing.md',
    'references/%00start.md',
    '%broken',
  ])
    assert.equal(resolveToolkitSkillLink('SKILL.md', href, files), null, href);
});
