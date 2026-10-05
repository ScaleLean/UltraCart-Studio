import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, win32 } from 'node:path';
import type { WarehouseIssue, WarehouseIssueCode } from '../shared/warehouse';

const documentation = {
  startup: {
    label: 'Google Cloud CLI startup',
    url: 'https://docs.cloud.google.com/sdk/gcloud/reference/topic/startup',
  },
  install: { label: 'Install Google Cloud CLI', url: 'https://docs.cloud.google.com/sdk/docs/install' },
  auth: {
    label: 'Google Cloud CLI authentication',
    url: 'https://docs.cloud.google.com/sdk/docs/authenticate',
  },
  errors: {
    label: 'BigQuery error reference',
    url: 'https://docs.cloud.google.com/bigquery/docs/error-messages',
  },
  access: {
    label: 'BigQuery access control',
    url: 'https://docs.cloud.google.com/bigquery/docs/access-control',
  },
  config: {
    label: 'Google Cloud CLI configurations',
    url: 'https://docs.cloud.google.com/sdk/docs/configurations',
  },
};

export function warehouseIssue(code: WarehouseIssueCode): WarehouseIssue {
  const issues: Record<WarehouseIssueCode, Omit<WarehouseIssue, 'code'>> = {
    executable_missing: {
      title: 'BigQuery CLI was not found',
      detail:
        'Studio could not start the configured executable. A terminal alias or relative command is not an executable path.',
      steps: [
        'Find bq in your terminal, then paste its full path here.',
        'If the file exists, check its interpreter and rerun the connection checks.',
      ],
      docs: documentation.install,
    },
    executable_permission: {
      title: 'The CLI cannot be started',
      detail: 'The operating system refused to execute the configured file.',
      steps: [
        'Select the bq executable from your Google Cloud CLI installation.',
        'Check the file permissions or repair that installation. Signing in again will not fix a file permission error.',
      ],
      docs: documentation.install,
    },
    launcher_unsupported: {
      title: 'This CLI launcher needs its SDK runtime',
      detail: 'Studio could not find the Python runtime and scripts for this Google Cloud SDK launcher.',
      steps: [
        'Select bq.cmd from a complete Google Cloud CLI installation with bundled Python.',
        'For a custom runtime, use an absolute Python .exe path in CLOUDSDK_BQ_PYTHON. Studio does not support custom CLOUDSDK_PYTHON_ARGS for Windows batch launchers.',
      ],
      docs: documentation.install,
    },
    python_runtime: {
      title: 'Google Cloud CLI could not start Python',
      detail:
        'The CLI failed before it could check your account. Python startup messages can mention authentication libraries without indicating a sign-in problem.',
      steps: [
        'Studio includes common CLI installation folders in its process PATH. Run the checks again after saving the executable path.',
        'If it still fails, repair or update the Google Cloud CLI installation. Check any CLOUDSDK_PYTHON or CLOUDSDK_BQ_PYTHON override in the app launch environment.',
      ],
      docs: documentation.startup,
    },
    cli_configuration: {
      title: 'The CLI configuration needs attention',
      detail: 'Google Cloud CLI could not read or write its configuration, or rejected a CLI option.',
      steps: [
        'Confirm the same installation works in your terminal.',
        'Check access to the Cloud SDK configuration directory and any CLOUDSDK_CONFIG override. Update the CLI if it rejects a supported option.',
      ],
      docs: documentation.config,
    },
    auth_missing: {
      title: 'No active Google Cloud CLI account',
      detail:
        'The CLI did not find an active credential for this process. Browser sign-in and Application Default Credentials are separate from CLI sign-in.',
      steps: [
        'Run the account check below using this installation.',
        'Select your existing CLI account, or use gcloud auth login if no account is available. Check CLOUDSDK_CONFIG when the terminal is already signed in.',
      ],
      docs: documentation.auth,
    },
    auth_expired: {
      title: 'Google Cloud CLI needs reauthentication',
      detail: 'The CLI reported an expired, revoked, or invalid credential.',
      steps: [
        'Run gcloud auth login in your terminal for the account that has warehouse access.',
        'Return to Studio and run the connection checks again.',
      ],
      docs: documentation.auth,
    },
    access_denied: {
      title: 'The account lacks warehouse access',
      detail:
        'Google Cloud denied this operation. A successful sign-in does not grant permission to a project or dataset.',
      steps: [
        'Confirm the active CLI account is the intended warehouse account.',
        'Ask the warehouse administrator to check the specific denied permission on this project and its curated and streaming datasets. A query also needs bigquery.jobs.create.',
      ],
      docs: documentation.access,
    },
    api_disabled: {
      title: 'The project cannot use BigQuery yet',
      detail: 'Google Cloud reported a disabled API or project billing configuration.',
      steps: [
        'Ask the project administrator to check the BigQuery API and billing configuration.',
        'Studio does not change project APIs, billing, or permissions.',
      ],
      docs: documentation.errors,
    },
    network: {
      title: 'Google Cloud could not be reached',
      detail: 'The CLI reported a network, proxy, DNS, or TLS connection failure.',
      steps: [
        'Check your connection, VPN, proxy, and certificate configuration.',
        'Try the read-only metadata command below in your terminal. Repeated sign-in will not repair a network failure.',
      ],
      docs: documentation.errors,
    },
    not_found: {
      title: 'The warehouse resource was not found',
      detail: 'BigQuery reported a missing project, dataset, or table, or an incompatible location.',
      steps: [
        'Confirm the selected merchant and warehouse project.',
        'Ask the warehouse administrator to check dataset availability and location. Reload the schema before editing SQL.',
      ],
      docs: documentation.errors,
    },
    scan_limit: {
      title: 'The query exceeded its scan ceiling',
      detail:
        'BigQuery refused the query because its estimated or billed bytes exceeded the configured limit.',
      steps: [
        'Add a partition or date filter, or select fewer columns.',
        'Run another dry run to review the new estimate before executing.',
      ],
      docs: documentation.errors,
    },
    sql: {
      title: 'BigQuery rejected the SQL',
      detail: 'BigQuery reported a syntax, field, type, or function error.',
      steps: ['Check the query against the current table schema.', 'Correct the SQL and run a new dry run.'],
      docs: documentation.errors,
    },
    timeout: {
      title: 'The CLI check timed out',
      detail:
        'Studio did not receive a response before the time limit. If a query was submitted, it may still complete.',
      steps: [
        'Check the connection and query history before retrying an execution.',
        'Use the connection checks to test startup and metadata without running a query.',
      ],
      docs: documentation.errors,
    },
    output_limit: {
      title: 'The CLI response was too large',
      detail: 'Studio stopped reading an oversized response.',
      steps: [
        'Select fewer columns or rows, then run a new dry run.',
        'Check query history before retrying an execution.',
      ],
      docs: documentation.errors,
    },
    unknown: {
      title: 'The CLI request failed',
      detail:
        'Studio could not identify the cause from the CLI response. This does not confirm a sign-in problem.',
      steps: [
        'Run the connection checks to separate startup, account, and metadata access.',
        'If it still fails, run the read-only commands below in your terminal and inspect the exact error there. Remove account identifiers and secrets before sharing it.',
      ],
      docs: documentation.errors,
    },
  };
  return { code, ...issues[code] };
}

/** Raw CLI output is used for classification only. It must not enter IPC, logs, or local history. */
export function classifyWarehouseFailure(output: string, spawnCode?: string): WarehouseIssue {
  if (spawnCode === 'ENOENT') return warehouseIssue('executable_missing');
  if (spawnCode === 'EACCES' || spawnCode === 'EPERM') return warehouseIssue('executable_permission');
  if (spawnCode === 'ENOEXEC' || spawnCode === 'EINVAL') return warehouseIssue('launcher_unsupported');
  const text = output.slice(-32000);
  if (
    /SyntaxError:|ModuleNotFoundError:|ImportError:|No module named|bad interpreter|python[^\n]*(?:not found|No such file|not recognized|must be installed|unsupported|requires)|must have Python|cannot find[^\n]*python|incompatible Python/i.test(
      text
    )
  )
    return warehouseIssue('python_runtime');
  if (
    /PermissionError:|read.only (?:file system|database)|(?:could not|cannot|unable to) (?:create|write|open)[^\n]*(?:log|config)|(?:gcloud|\.config)[^\n]*Permission denied|Unrecognized (?:flags?|arguments?)|Unknown command line flag/i.test(
      text
    )
  )
    return warehouseIssue('cli_configuration');
  if (
    /invalid_grant|invalid_rapt|invalid_token|invalid authentication credentials|401[^\n]*Unauthorized|reauthentication|reauth(?:enticate|entication) is needed|credentials? (?:have |has )?(?:expired|revoked)|token (?:has )?(?:expired|revoked)|refresh[^\n]*invalid/i.test(
      text
    )
  )
    return warehouseIssue('auth_expired');
  if (
    /no active account|do not currently have an active account|no (?:valid )?credentials|could not (?:automatically )?(?:determine|load|find)[^\n]*credentials|please (?:run|log in using)[^\n]*gcloud auth login|not have any credentials|login required/i.test(
      text
    )
  )
    return warehouseIssue('auth_missing');
  if (
    /SERVICE_DISABLED|accessNotConfigured|API[^\n]*(?:not been used|disabled)|billingNotEnabled|billing[^\n]*(?:disabled|not enabled)/i.test(
      text
    )
  )
    return warehouseIssue('api_disabled');
  if (
    /CERTIFICATE_VERIFY_FAILED|SSLError|ProxyError|ConnectionError|Connection refused|NameResolutionError|Name or service not known|Temporary failure in name resolution|Network is unreachable|timed out|UNAVAILABLE|TransportError/i.test(
      text
    )
  )
    return warehouseIssue('network');
  if (
    /maximum[_ ]bytes[_ ]billed|bytes billed limit|bytes processed[^\n]*limit|Query exceeded limit for bytes billed/i.test(
      text
    )
  )
    return warehouseIssue('scan_limit');
  if (
    /access denied|accessDenied|PERMISSION_DENIED|does not have[^\n]*permission|permission[^\n]*denied|forbidden/i.test(
      text
    )
  )
    return warehouseIssue('access_denied');
  if (/not found: (?:dataset|table|project)|Not found in location|notFound|does not exist/i.test(text))
    return warehouseIssue('not_found');
  if (
    /Syntax error:|Unrecognized name:|No matching signature|Invalid (?:query|SQL)|Function not found:|Cannot access field/i.test(
      text
    )
  )
    return warehouseIssue('sql');
  return warehouseIssue('unknown');
}

export class WarehouseCliError extends Error {
  constructor(readonly issue: WarehouseIssue) {
    super(`${issue.title}. ${issue.detail} Open Warehouse connection for checks and fixes.`);
    this.name = 'WarehouseCliError';
  }
}

type LaunchOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (file: string) => boolean;
  realpath?: (file: string) => string;
};

export function warehouseProcessEnv(command: string, options: LaunchOptions = {}): NodeJS.ProcessEnv {
  const platform = options.platform ?? process.platform;
  const env: NodeJS.ProcessEnv = { ...(options.env ?? process.env), CLOUDSDK_CORE_DISABLE_PROMPTS: '1' };
  const path = platform === 'win32' ? win32 : { dirname, join };
  const pathKey =
    Object.keys(env).find((key) => platform === 'win32' && key.toLowerCase() === 'path') || 'PATH';
  if (platform === 'win32')
    for (const key of Object.keys(env)) if (key !== pathKey && key.toLowerCase() === 'path') delete env[key];
  const parts = [path.dirname(command)];
  if (platform === 'darwin') parts.push('/opt/homebrew/bin', '/usr/local/bin');
  if (platform === 'linux') parts.push('/usr/local/bin', '/usr/bin', '/bin');
  parts.push(...(env[pathKey] || '').split(platform === 'win32' ? ';' : ':').filter(Boolean));
  env[pathKey] = [...new Set(parts)].join(platform === 'win32' ? ';' : ':');
  return env;
}

export function warehouseLaunch(command: string, args: string[], options: LaunchOptions = {}) {
  const platform = options.platform ?? process.platform;
  const env = warehouseProcessEnv(command, options);
  if (platform !== 'win32' || !/\.(?:cmd|bat|ps1)$/i.test(command)) return { command, args, env };
  // Windows batch launchers require cmd.exe. Invoke the SDK's own Python entry point instead,
  // so a query containing shell metacharacters remains one literal process argument.
  const tool = /^(bq|gcloud)\.(?:cmd|bat)$/i.exec(win32.basename(command))?.[1].toLowerCase();
  if (!tool) throw new WarehouseCliError(warehouseIssue('launcher_unsupported'));
  const exists = options.exists ?? existsSync;
  const resolve = options.realpath ?? realpathSync;
  let root: string;
  try {
    root = win32.dirname(win32.dirname(resolve(command)));
  } catch {
    throw new WarehouseCliError(warehouseIssue('executable_missing'));
  }
  const script =
    tool === 'bq' ? win32.join(root, 'bin', 'bootstrapping', 'bq.py') : win32.join(root, 'lib', 'gcloud.py');
  const python =
    (tool === 'bq' && env.CLOUDSDK_BQ_PYTHON) ||
    env.CLOUDSDK_PYTHON ||
    win32.join(root, 'platform', 'bundledpython', 'python.exe');
  if (
    !win32.isAbsolute(python) ||
    !/\.exe$/i.test(python) ||
    !exists(python) ||
    !exists(script) ||
    env.CLOUDSDK_PYTHON_ARGS
  )
    throw new WarehouseCliError(warehouseIssue('launcher_unsupported'));
  return {
    command: python,
    args: [script, ...args],
    env: { ...env, CLOUDSDK_ROOT_DIR: root, PYTHONIOENCODING: 'utf-8' },
  };
}

export function warehouseDefaultBq(exists: (file: string) => boolean = existsSync) {
  const name = process.platform === 'win32' ? 'bq.cmd' : 'bq';
  const locations =
    process.platform === 'win32'
      ? [join(process.env.LOCALAPPDATA || homedir(), 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', name)]
      : [
          '/opt/homebrew/bin/bq',
          '/usr/local/bin/bq',
          '/usr/bin/bq',
          join(homedir(), 'google-cloud-sdk', 'bin', name),
        ];
  locations.push(
    ...(process.env.PATH || '')
      .split(process.platform === 'win32' ? ';' : ':')
      .filter(Boolean)
      .map((dir) => join(dir, name))
  );
  return locations.find(exists) || locations[0];
}

export function warehouseGcloudPath(bqPath: string, exists: (file: string) => boolean = existsSync) {
  const name = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
  const candidates = [join(dirname(bqPath), name)];
  try {
    candidates.push(join(dirname(realpathSync(bqPath)), name));
  } catch {
    /* Missing executable is diagnosed separately. */
  }
  return candidates.find(exists) || null;
}

export function warehouseTerminalCommand(executable: string, args: string[], platform = process.platform) {
  if (platform === 'win32')
    return '& ' + [executable, ...args].map((part) => `'${part.replaceAll("'", "''")}'`).join(' ');
  return [executable, ...args]
    .map((part) => (/^[A-Za-z0-9_./:=+-]+$/.test(part) ? part : `'${part.replaceAll("'", "'\\''")}'`))
    .join(' ');
}

export type WarehouseRunner = (command: string, args: string[]) => Promise<string>;
export const runWarehouseCommand: WarehouseRunner = (command, args) =>
  new Promise((resolve, reject) => {
    let launch: ReturnType<typeof warehouseLaunch>;
    try {
      launch = warehouseLaunch(command, args);
    } catch (error) {
      reject(error);
      return;
    }
    const child = spawn(launch.command, launch.args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: launch.env,
    });
    let stdout = '',
      stderr = '',
      settled = false;
    const finish = (issue?: WarehouseIssue) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      issue ? reject(new WarehouseCliError(issue)) : resolve(stdout);
    };
    const timer = setTimeout(
      () => {
        child.kill();
        finish(warehouseIssue('timeout'));
      },
      args.includes('version') || args.includes('auth') ? 20_000 : args.includes('query') ? 90_000 : 60_000
    );
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > 4 * 1024 ** 2) {
        child.kill();
        finish(warehouseIssue('output_limit'));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-16000);
    });
    child.on('error', (error: NodeJS.ErrnoException) => finish(classifyWarehouseFailure('', error.code)));
    child.on('close', (code) =>
      finish(code === 0 ? undefined : classifyWarehouseFailure(stderr + '\n' + stdout))
    );
  });
