import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function launch(directory: string, operation: string, phase: string) {
  return spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/fixtures/crash-worker.ts', directory, operation, phase],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );
}
function outputUntil(child: ChildProcess, marker: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '',
      stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out waiting for ${marker}: ${stderr}`));
    }, 15_000);
    const finish = (error?: Error, value?: string) => {
      clearTimeout(timeout);
      error ? reject(error) : resolve(value!);
    };
    child.stderr!.on('data', (bytes) => {
      stderr += bytes.toString();
    });
    child.stdout!.on('data', (bytes) => {
      stdout += bytes.toString();
      const line = stdout.split('\n').find((line) => line.startsWith(marker));
      if (line) finish(undefined, line.slice(marker.length));
    });
    child.on('error', (error) => finish(error));
    child.on('exit', (code) => {
      if (!stdout.includes(marker)) finish(new Error(`Child exited ${code}: ${stderr}`));
    });
  });
}
function exited(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once('exit', () => resolve()));
}
for (const operation of ['safe', 'unsafe']) {
  test(
    `forced process death recovers ${operation} tools without duplicating saved edits`,
    { timeout: 35_000 },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), `studio-crash-${operation}-`));
      let child: ChildProcess | undefined;
      try {
        child = launch(directory, operation, 'start');
        await outputUntil(child, 'CHECKPOINT');
        child.kill('SIGKILL');
        await exited(child);
        child = launch(directory, operation, 'recover');
        const result = JSON.parse(await outputUntil(child, 'RESULT '));
        await exited(child);
        assert.equal(child.exitCode, 0);
        assert.equal(result.executions, operation === 'safe' ? 2 : 1);
        assert.equal(result.revision, operation === 'safe' ? 1 : 2);
        assert(result.messages.some((m: any) => m.text === 'Recovery completed.'));
        if (operation === 'unsafe') assert(result.messages.some((m: any) => m.role === 'tool' && m.error));
      } finally {
        child?.kill('SIGKILL');
        if (child) await exited(child);
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
}
