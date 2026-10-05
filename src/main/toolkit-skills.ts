import { createHash } from 'node:crypto';
import { constants, type Dirent } from 'node:fs';
import { lstat, open, opendir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path';
import { z } from 'zod';
import type { StudioServices } from './services';
import type {
  ToolkitSkillDocument,
  ToolkitSkillFile,
  ToolkitSkillIndex,
  ToolkitSkillSummary,
} from '../shared/toolkit-skills';

const PACKAGE_NAME = '@ultracart/storefront-agent-toolchain';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_SKILLS = 100;
const MAX_FILES = 1000;
const MAX_ENTRIES = 5000;
const MAX_DEPTH = 8;
const textExtensions = new Set([
  '.md',
  '.txt',
  '.yaml',
  '.yml',
  '.json',
  '.sh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.css',
  '.html',
  '.toml',
]);
const documentNames = new Set(['SKILL.md', 'README.md', 'SAFETY.md', 'COPYING.md', 'LICENSE', 'NOTICE']);
const documentDirectories = new Set(['references', 'agents', 'scripts']);
const idSchema = z.string().regex(/^[a-f0-9]{40}$/);
const readSchema = z
  .object({ installationId: idSchema, skillId: idSchema, fileId: idSchema.optional() })
  .strict();
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 40);
const display = (value: string, limit: number) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
const safeName = (value: string) =>
  value.length <= 160 && !value.startsWith('.') && !/[\\/\u0000-\u001f\u007f]/.test(value);
const unavailableMessage =
  'The configured CLI is not a readable UltraCart toolkit installation. Select its dist/bin.js executable in Connections, then refresh.';
const readMessage =
  'This toolkit document is no longer available or cannot be read safely. Refresh the installed skills and try again.';

class SkillReadError extends Error {}
async function boundedDirectory(path: string): Promise<Dirent[]> {
  const entries: Dirent[] = [];
  const directory = await opendir(path);
  for await (const entry of directory) {
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) break;
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
function within(root: string, target: string) {
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

/** Check each component as well as its real path. Directory links are not followed. */
async function checkedPath(root: string, path: string) {
  if (!within(root, path)) throw new SkillReadError(readMessage);
  const parts = relative(root, path).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new SkillReadError(readMessage);
  }
  const resolved = await realpath(path);
  if (!within(root, resolved)) throw new SkillReadError(readMessage);
  return resolved;
}

async function readText(root: string, path: string, limit = MAX_FILE_BYTES) {
  const resolved = await checkedPath(root, path);
  const before = await stat(resolved);
  if (!before.isFile() || before.size > limit) throw new SkillReadError(readMessage);
  const file = await open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await file.stat();
    if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino || opened.size > limit)
      throw new SkillReadError(readMessage);
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length <= limit) {
      const result = await file.read(buffer, length, buffer.length - length, length);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    const after = await file.stat();
    if (
      length > limit ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs
    )
      throw new SkillReadError(readMessage);
    await checkedPath(root, path);
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
    } catch {
      throw new SkillReadError(readMessage);
    }
    if (text.includes('\0')) throw new SkillReadError(readMessage);
    return text;
  } finally {
    await file.close();
  }
}

function metadata(markdown: string, fallback: string) {
  const frontmatter = /^---\r?\n([\s\S]{0,16000}?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1];
  const field = (name: string) => {
    if (!frontmatter) return '';
    const lines = frontmatter.split(/\r?\n/);
    const start = lines.findIndex((line) => line.startsWith(`${name}:`));
    if (start < 0) return '';
    let value = lines[start].slice(name.length + 1).trim();
    if (/^[>|][+-]?$/.test(value)) {
      const parts: string[] = [];
      for (const line of lines.slice(start + 1)) {
        if (line && !/^\s/.test(line)) break;
        parts.push(line.trim());
      }
      value = parts.join(' ');
    } else if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replaceAll("''", "'");
    return value;
  };
  return {
    name: display(field('name') || /^#\s+(.+)$/m.exec(markdown)?.[1] || fallback, 160),
    description: display(field('description'), 2000),
  };
}

type Installation = { root: string; cliPath: string; configuredPath: string; version: string; id: string };
type SkillRecord = { summary: ToolkitSkillSummary; directory: string; files: Map<string, string> };
type Inventory = { index: ToolkitSkillIndex; installation: Installation; records: Map<string, SkillRecord> };

export class ToolkitSkillsService {
  constructor(private services: Pick<StudioServices, 'settings'>) {}

  private async installation(): Promise<Installation> {
    const configuredPath = this.services.settings().cliPath;
    if (!configuredPath || !isAbsolute(configuredPath) || /[\u0000-\u001f\u007f]/.test(configuredPath))
      throw new SkillReadError(unavailableMessage);
    const cliPath = await realpath(configuredPath);
    if (
      basename(cliPath) !== 'bin.js' ||
      basename(dirname(cliPath)) !== 'dist' ||
      !(await stat(cliPath)).isFile()
    )
      throw new SkillReadError(unavailableMessage);
    const root = dirname(dirname(cliPath));
    const raw = await readText(root, join(root, 'package.json'), MAX_MANIFEST_BYTES);
    const manifest: unknown = JSON.parse(raw);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
      throw new SkillReadError(unavailableMessage);
    const { name, version, bin } = manifest as Record<string, unknown>;
    const executable =
      typeof bin === 'object' && bin && !Array.isArray(bin)
        ? (bin as Record<string, unknown>)['uc-storefront']
        : undefined;
    if (
      name !== PACKAGE_NAME ||
      typeof version !== 'string' ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) ||
      !['dist/bin.js', './dist/bin.js'].includes(String(executable))
    )
      throw new SkillReadError(unavailableMessage);
    if ((await checkedPath(root, join(root, 'dist', 'bin.js'))) !== cliPath)
      throw new SkillReadError(unavailableMessage);
    return { root, cliPath, configuredPath, version, id: digest(JSON.stringify([cliPath, raw])) };
  }

  private assertCurrent(installation: Installation) {
    if (this.services.settings().cliPath !== installation.configuredPath)
      throw new SkillReadError(
        'The toolkit installation changed. Refresh the installed skills before opening a document.'
      );
  }

  private async inventory(): Promise<Inventory> {
    const installation = await this.installation();
    const index: ToolkitSkillIndex = {
      status: 'ready',
      packageName: PACKAGE_NAME,
      packageVersion: installation.version,
      installationId: installation.id,
      skills: [],
      issues: [],
    };
    const records = new Map<string, SkillRecord>();
    const issues = new Set<string>();
    const skillsRoot = join(installation.root, 'skills');
    let top: string[];
    try {
      await checkedPath(installation.root, skillsRoot);
      top = (await boundedDirectory(skillsRoot)).map((entry) => entry.name);
    } catch {
      index.issues.push('This installation does not contain a readable bundled skills directory.');
      this.assertCurrent(installation);
      return { index, installation, records };
    }
    let inspected = 0;
    const budget = () => {
      if (++inspected > MAX_ENTRIES) {
        issues.add('The installed skills inventory exceeds the file limit. Some entries are not shown.');
        return false;
      }
      return true;
    };
    for (const name of top.sort()) {
      if (!budget()) break;
      if (!safeName(name)) continue;
      if (index.skills.length >= MAX_SKILLS) {
        issues.add('This installation exceeds the skill limit. Some skills are not shown.');
        break;
      }
      const directory = join(skillsRoot, name);
      try {
        await checkedPath(skillsRoot, directory);
        if (!(await stat(directory)).isDirectory()) continue;
        const entry = await readText(directory, join(directory, 'SKILL.md'));
        const files: ToolkitSkillFile[] = [];
        const filePaths = new Map<string, string>();
        const addFile = async (path: string) => {
          if (files.length >= MAX_FILES) {
            issues.add('A skill exceeds the document limit. Some documents are not shown.');
            return;
          }
          try {
            const absolute = join(directory, ...path.split('/'));
            const canonical = await checkedPath(directory, absolute);
            const info = await stat(canonical);
            if (!info.isFile()) return;
            if (info.size > MAX_FILE_BYTES) {
              issues.add('Some toolkit documents exceed the size limit and are not shown.');
              return;
            }
            const id = digest(path);
            files.push({
              id,
              path,
              format: extname(path).toLowerCase() === '.md' ? 'markdown' : 'text',
              bytes: info.size,
            });
            filePaths.set(id, absolute);
          } catch {
            issues.add('Some toolkit files could not be listed safely and were skipped.');
          }
        };
        const visit = async (path: string, depth: number) => {
          if (depth > MAX_DEPTH) {
            issues.add('Some toolkit document folders exceed the depth limit and are not shown.');
            return;
          }
          const absolute = join(directory, ...path.split('/'));
          try {
            await checkedPath(directory, absolute);
            const entries = await boundedDirectory(absolute);
            for (const item of entries) {
              if (!budget()) return;
              if (!safeName(item.name)) continue;
              const child = `${path}/${item.name}`;
              if (item.isDirectory()) await visit(child, depth + 1);
              else if (item.isFile() && textExtensions.has(extname(item.name).toLowerCase()))
                await addFile(child);
              else if (item.isSymbolicLink()) issues.add('Linked toolkit documents are not followed.');
            }
          } catch {
            issues.add('Some toolkit document folders could not be listed safely and were skipped.');
          }
        };
        await addFile('SKILL.md');
        const children = await boundedDirectory(directory);
        for (const item of children) {
          if (!budget()) break;
          if (item.isFile() && item.name !== 'SKILL.md' && documentNames.has(item.name))
            await addFile(item.name);
          else if (item.isDirectory() && documentDirectories.has(item.name)) await visit(item.name, 1);
          else if (item.isSymbolicLink()) issues.add('Linked toolkit documents are not followed.');
        }
        const entryFileId = digest('SKILL.md');
        if (!filePaths.has(entryFileId)) throw new SkillReadError(readMessage);
        files.sort((a, b) =>
          a.id === entryFileId ? -1 : b.id === entryFileId ? 1 : a.path.localeCompare(b.path)
        );
        const summary = { id: digest(name), ...metadata(entry, name), entryFileId, files };
        index.skills.push(summary);
        records.set(summary.id, { summary, directory, files: filePaths });
      } catch {
        issues.add('Some skill folders have missing, oversized, or unsafe SKILL.md files and were skipped.');
      }
    }
    this.assertCurrent(installation);
    index.skills.sort((a, b) => a.name.localeCompare(b.name));
    index.issues.push(...issues);
    return { index, installation, records };
  }

  async list(input: unknown = {}): Promise<ToolkitSkillIndex> {
    if (!z.object({}).strict().safeParse(input).success)
      throw new Error('The installed skills request is invalid.');
    try {
      return (await this.inventory()).index;
    } catch {
      return {
        status: 'unavailable',
        packageName: PACKAGE_NAME,
        packageVersion: null,
        installationId: null,
        skills: [],
        issues: [unavailableMessage],
      };
    }
  }

  async read(input: unknown): Promise<ToolkitSkillDocument> {
    const parsed = readSchema.safeParse(input);
    if (!parsed.success) throw new Error('Choose a document from the installed toolkit skills list.');
    try {
      const { index, installation, records } = await this.inventory();
      if (index.installationId !== parsed.data.installationId)
        throw new SkillReadError(
          'The toolkit installation changed. Refresh the installed skills before opening a document.'
        );
      const record = records.get(parsed.data.skillId);
      const fileId = parsed.data.fileId ?? record?.summary.entryFileId;
      const file = record?.summary.files.find((item) => item.id === fileId);
      const path = fileId && record?.files.get(fileId);
      if (!record || !file || !path) throw new SkillReadError(readMessage);
      const content = await readText(record.directory, path);
      this.assertCurrent(installation);
      const current = await this.installation();
      if (current.id !== installation.id)
        throw new SkillReadError(
          'The toolkit installation changed. Refresh the installed skills before opening a document.'
        );
      return {
        installationId: installation.id,
        skillId: record.summary.id,
        fileId: file.id,
        path: file.path,
        format: file.format,
        content,
      };
    } catch (error) {
      throw new Error(error instanceof SkillReadError ? error.message : readMessage);
    }
  }
}
