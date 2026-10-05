import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ToolkitSkillsService } from '../src/main/toolkit-skills';
import type { StudioServices } from '../src/main/services';

const packageName = '@ultracart/storefront-agent-toolchain';
const manifest = { name: packageName, version: '1.2.3', bin: { 'uc-storefront': './dist/bin.js' } };

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'studio-toolkit-skills-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'toolkit');
  const put = async (relativePath: string, content: string | Uint8Array) => {
    const path = join(root, ...relativePath.split('/'));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return path;
  };
  await put('package.json', JSON.stringify(manifest));
  const cli = await put('dist/bin.js', `throw new Error('Fixture CLI must never execute')`);
  await put(
    'skills/example/SKILL.md',
    '---\nname: Example skill\ndescription: A fictional toolkit skill for tests.\n---\n\n# Example\n\nRead the fictional reference.'
  );
  let configured = cli;
  const services = { settings: () => ({ cliPath: configured }) } as Pick<StudioServices, 'settings'>;
  return {
    root,
    directory,
    cli,
    put,
    service: new ToolkitSkillsService(services),
    configure: (path: string) => {
      configured = path;
    },
  };
}

test('lists every bundled skill and its safe supporting text documents with stable opaque IDs', async (t) => {
  const f = await fixture(t);
  await f.put('skills/example/SAFETY.md', '# Fictional safety note');
  await f.put('skills/example/NOTICE', 'Fictional notice');
  await f.put(
    'skills/example/references/deep/topic.md',
    '# Reference\nPrivate installed documentation fixture.'
  );
  await f.put('skills/example/agents/openai.yaml', 'display_name: Example');
  await f.put('skills/example/scripts/helper.py', 'raise RuntimeError("Never execute")');
  await f.put('skills/example/references/image.png', new Uint8Array([137, 80, 78, 71]));
  await f.put('skills/example/.env', 'PRIVATE_VALUE=not-in-the-catalog');
  await f.put(
    'skills/second/SKILL.md',
    '---\nname: Second\ndescription: >-\n  Multi-line text\n  stays readable.\n---\n# Second'
  );
  const index = await f.service.list();
  assert.equal(index.status, 'ready');
  assert.equal(index.packageName, packageName);
  assert.equal(index.packageVersion, '1.2.3');
  assert.equal(index.skills.length, 2);
  assert.deepEqual(index.issues, []);
  assert.equal(index.skills[1].description, 'Multi-line text stays readable.');
  const skill = index.skills[0];
  assert.match(skill.id, /^[a-f0-9]{40}$/);
  assert.equal(skill.files.length, 6);
  assert.equal(skill.files[0].path, 'SKILL.md');
  assert.equal(skill.entryFileId, skill.files[0].id);
  assert.equal(skill.files.find((file) => file.path === 'agents/openai.yaml')!.format, 'text');
  assert.doesNotMatch(
    JSON.stringify(index),
    /PRIVATE_VALUE|not-in-the-catalog|Never execute|studio-toolkit-skills-/
  );
  const again = await f.service.list();
  assert.deepEqual(again, index);
  const document = await f.service.read({ installationId: index.installationId, skillId: skill.id });
  assert.equal(document.path, 'SKILL.md');
  assert.match(document.content, /fictional toolkit skill/);
  const ref = skill.files.find((file) => file.path === 'references/deep/topic.md')!;
  const reference = await f.service.read({
    installationId: index.installationId,
    skillId: skill.id,
    fileId: ref.id,
  });
  assert.match(reference.content, /documentation fixture/);
  assert.equal(reference.format, 'markdown');
});

test('only the configured package is scanned, without probing user or project agent skill copies', async (t) => {
  const f = await fixture(t);
  await f.put('.agents/skills/unrelated/SKILL.md', '# Not toolkit content');
  await f.put('.claude/skills/unrelated/SKILL.md', '# Not toolkit content');
  await mkdir(join(f.directory, '.agents', 'skills', 'other'), { recursive: true });
  await writeFile(join(f.directory, '.agents', 'skills', 'other', 'SKILL.md'), '# Other private skill');
  const index = await f.service.list();
  assert.equal(index.skills.length, 1);
  assert.doesNotMatch(JSON.stringify(index), /Other private skill|unrelated/);
});

test('validates the package name, version, declared executable, and canonical dist/bin.js layout', async (t) => {
  const f = await fixture(t);
  for (const value of [
    { ...manifest, name: '@different/toolkit' },
    { ...manifest, version: '../secret' },
    { ...manifest, bin: { 'uc-storefront': '../other/dist/bin.js' } },
    { ...manifest, bin: { other: './dist/bin.js' } },
  ]) {
    await f.put('package.json', JSON.stringify(value));
    const index = await f.service.list();
    assert.equal(index.status, 'unavailable');
    assert.equal(index.installationId, null);
    assert.equal(index.skills.length, 0);
    assert.doesNotMatch(JSON.stringify(index), /studio-toolkit-skills-|different|\.\.\/secret/);
  }
  await f.put('package.json', JSON.stringify(manifest));
  const other = await f.put('dist/cli.js', 'throw new Error("Do not execute")');
  f.configure(other);
  assert.equal((await f.service.list()).status, 'unavailable');
  f.configure('dist/bin.js');
  assert.equal((await f.service.list()).status, 'unavailable');
  f.configure(f.cli);
  await f.put('package.json', '{ "name": secret-malformed-value }');
  const result = await f.service.list();
  assert.equal(result.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(result), /secret-malformed-value/);
});

test('resolves an installed command symlink to its packaged dist/bin.js without executing it', async (t) => {
  const f = await fixture(t);
  const alias = join(f.directory, 'uc-storefront');
  try {
    await symlink(f.cli, alias, 'file');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      t.skip('File symlinks require a host permission.');
      return;
    }
    throw error;
  }
  const original = await f.service.list();
  f.configure(alias);
  const linked = await f.service.list();
  assert.equal(linked.status, 'ready');
  assert.equal(linked.installationId, original.installationId);
  assert.equal(linked.skills.length, 1);
});

test('rejects arbitrary renderer paths, extra arguments and unknown opaque document IDs', async (t) => {
  const f = await fixture(t);
  const index = await f.service.list();
  const scope = { installationId: index.installationId, skillId: index.skills[0].id };
  await assert.rejects(f.service.list({ directory: f.directory }), /request is invalid/);
  await assert.rejects(f.service.read({ ...scope, path: '../package.json' }), /Choose a document/);
  await assert.rejects(f.service.read({ ...scope, fileId: '../../private' }), /Choose a document/);
  await assert.rejects(f.service.read({ ...scope, fileId: 'a'.repeat(40) }), /no longer available/);
  await assert.rejects(f.service.read({ ...scope, skillId: 'b'.repeat(40) }), /no longer available/);
});

test('stale installation IDs reject package upgrades and configured executable changes', async (t) => {
  const f = await fixture(t);
  const original = await f.service.list();
  const scope = { installationId: original.installationId, skillId: original.skills[0].id };
  await f.put('package.json', JSON.stringify({ ...manifest, version: '1.2.4' }));
  await assert.rejects(f.service.read(scope), /installation changed/);
  const upgraded = await f.service.list();
  assert.notEqual(upgraded.installationId, original.installationId);
  assert.equal(upgraded.skills[0].id, original.skills[0].id);
  const other = await fixture(t);
  f.configure(other.cli);
  await assert.rejects(
    f.service.read({ ...scope, installationId: upgraded.installationId }),
    /installation changed/
  );
});

test('a settings change during discovery cannot return documents from the old installation', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const service = new ToolkitSkillsService({
    settings: () => ({ cliPath: ++calls > 1 ? '/changed/toolkit/dist/bin.js' : f.cli }),
  } as Pick<StudioServices, 'settings'>);
  assert.equal((await service.list()).status, 'unavailable');
});

test('linked skill folders and reference directory escapes are omitted', async (t) => {
  const f = await fixture(t);
  const outside = join(f.directory, 'private-documents');
  await mkdir(outside);
  await writeFile(join(outside, 'SKILL.md'), '# Secret outside skill');
  await writeFile(join(outside, 'secret.md'), '# Private outside reference');
  await symlink(outside, join(f.root, 'skills', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await symlink(
    outside,
    join(f.root, 'skills', 'example', 'references'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  const index = await f.service.list();
  assert.equal(index.skills.length, 1);
  assert.equal(index.skills[0].files.length, 1);
  assert.ok(index.issues.length > 0);
  assert.doesNotMatch(JSON.stringify(index), /Secret outside|Private outside|private-documents|secret\.md/);
});

test('a file replaced with an external symlink after listing cannot be read', async (t) => {
  const f = await fixture(t);
  const path = await f.put('skills/example/references/guide.md', '# Original guide');
  const secret = join(f.directory, 'secret.md');
  await writeFile(secret, '# Do not read outside the package');
  const index = await f.service.list();
  const file = index.skills[0].files.find((entry) => entry.path === 'references/guide.md')!;
  await rm(path);
  try {
    await symlink(secret, path, 'file');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      t.skip('File symlinks require a host permission.');
      return;
    }
    throw error;
  }
  await assert.rejects(
    f.service.read({ installationId: index.installationId, skillId: index.skills[0].id, fileId: file.id }),
    /no longer available/
  );
});

test('a symlinked skills root or package manifest cannot expand the installation boundary', async (t) => {
  const f = await fixture(t);
  const outside = join(f.directory, 'outside');
  await mkdir(join(outside, 'foreign'), { recursive: true });
  await writeFile(join(outside, 'foreign', 'SKILL.md'), '# Outside');
  await rm(join(f.root, 'skills'), { recursive: true });
  await symlink(outside, join(f.root, 'skills'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await f.service.list();
  assert.equal(result.skills.length, 0);
  assert.ok(result.issues.length > 0);
  const foreignManifest = join(f.directory, 'foreign-package.json');
  await writeFile(foreignManifest, JSON.stringify(manifest));
  await rm(join(f.root, 'package.json'));
  try {
    await symlink(foreignManifest, join(f.root, 'package.json'), 'file');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      t.skip('File symlinks require a host permission.');
      return;
    }
    throw error;
  }
  assert.equal((await f.service.list()).status, 'unavailable');
});

test('bounds metadata, rejects oversized or binary text, and does not execute readable scripts', async (t) => {
  const f = await fixture(t);
  await f.put(
    'skills/example/SKILL.md',
    `---\nname: ${'N'.repeat(300)}\ndescription: ${'D'.repeat(3000)}\n---\n# Example`
  );
  await f.put('skills/example/references/large.md', 'x'.repeat(512 * 1024 + 1));
  await f.put('skills/example/references/binary.md', new Uint8Array([255, 254, 0, 1]));
  const marker = join(f.directory, 'must-not-exist');
  await f.put(
    'skills/example/scripts/script.js',
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`
  );
  await f.put('skills/oversized/SKILL.md', 'x'.repeat(512 * 1024 + 1));
  const index = await f.service.list();
  const skill = index.skills[0];
  assert.equal(index.skills.length, 1);
  assert.equal(skill.name.length, 160);
  assert.equal(skill.description.length, 2000);
  assert.equal(
    skill.files.some((file) => file.path === 'references/large.md'),
    false
  );
  const binary = skill.files.find((file) => file.path === 'references/binary.md')!;
  await assert.rejects(
    f.service.read({ installationId: index.installationId, skillId: skill.id, fileId: binary.id }),
    /read safely/
  );
  const script = skill.files.find((file) => file.path === 'scripts/script.js')!;
  const doc = await f.service.read({
    installationId: index.installationId,
    skillId: skill.id,
    fileId: script.id,
  });
  assert.equal(doc.format, 'text');
  assert.equal(existsSync(marker), false);
  assert.ok(index.issues.length > 0);
});

test('supports heading fallback and reports missing bundled skills without inventing a catalog', async (t) => {
  const f = await fixture(t);
  await f.put('skills/example/SKILL.md', '# Heading fallback\n\nInstructions.');
  const index = await f.service.list();
  assert.equal(index.skills[0].name, 'Heading fallback');
  assert.equal(index.skills[0].description, '');
  await rm(join(f.root, 'skills'), { recursive: true });
  const empty = await f.service.list();
  assert.equal(empty.status, 'ready');
  assert.equal(empty.skills.length, 0);
  assert.match(empty.issues[0], /bundled skills directory/);
});

test('document and depth limits preserve the skill entry and report omitted references', async (t) => {
  const f = await fixture(t);
  const referenceDirectory = join(f.root, 'skills', 'example', 'references');
  await mkdir(referenceDirectory, { recursive: true });
  for (let offset = 0; offset < 1005; offset += 30) {
    await Promise.all(
      Array.from({ length: Math.min(30, 1005 - offset) }, (_, index) =>
        writeFile(
          join(referenceDirectory, `reference-${String(offset + index).padStart(4, '0')}.md`),
          '# Fictional reference'
        )
      )
    );
  }
  const index = await f.service.list();
  assert.equal(index.skills.length, 1);
  assert.equal(index.skills[0].files.length, 1000);
  assert.equal(index.skills[0].files[0].path, 'SKILL.md');
  assert.ok(index.issues.some((issue) => issue.includes('document limit')));
  await rm(referenceDirectory, { recursive: true });
  await f.put('skills/example/references/a/b/c/d/e/f/g/h/i/too-deep.md', '# Too deep');
  const deep = await f.service.list();
  assert.equal(deep.skills[0].files.length, 1);
  assert.ok(deep.issues.some((issue) => issue.includes('depth limit')));
});
