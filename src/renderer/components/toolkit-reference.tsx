import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  ToolkitSkillIndex,
  ToolkitSkillDocument,
  ToolkitSkillSummary,
} from '../../shared/toolkit-skills';
import { errorText, invoke } from '../api';
import {
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  FileText,
  Folder,
  LoaderCircle,
  RefreshCw,
  Globe2,
  HardDrive,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Workflow,
} from 'lucide-react';
import type { Bootstrap } from '../../shared/types';
import {
  TOOLKIT_REFERENCE_DATE,
  TOOLKIT_REFERENCE_VERSION,
  searchToolkitCommands,
  resolveToolkitSkillLink,
  toolkitCommandChildren,
  toolkitCommands,
  toolkitCommandUsage,
  toolkitGlobalOptions,
  toolkitGuides,
  toolkitRisks,
  type ToolkitCommand,
  type ToolkitGuide,
  type ToolkitParameter,
  type ToolkitRisk,
} from '../../shared/toolkit-reference';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import './toolkit-reference.css';

type ReferenceMode = 'commands' | 'capabilities' | 'skills';

function CopyCode({ text, label = 'Copy command' }: { text: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };
  return (
    <div className="tk-code-block">
      <pre>
        <code>{text}</code>
      </pre>
      <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label={label}>
        {status === 'copied' ? <Check data-icon="inline-start" /> : <Clipboard data-icon="inline-start" />}
        {status === 'copied' ? 'Copied' : 'Copy'}
      </Button>
      {status === 'error' && (
        <span className="tk-copy-status" role="status">
          Select and copy the text manually.
        </span>
      )}
    </div>
  );
}

function Parameters({ items, title }: { items: ToolkitParameter[]; title: string }) {
  if (!items.length) return null;
  return (
    <section className="tk-section">
      <h3>
        {title}
        <span>{items.length}</span>
      </h3>
      <div className="tk-parameter-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Usage</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.syntax}>
                <td>
                  <code>{item.syntax}</code>
                  <div className="tk-parameter-tags">
                    {item.required && <Badge variant="secondary">Required</Badge>}
                    {item.defaultValue !== null && (
                      <span>
                        Default: <code>{item.defaultValue}</code>
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {item.description}
                  {item.choices && (
                    <div className="tk-choices">
                      Values:{' '}
                      {item.choices.map((choice) => (
                        <code key={choice}>{choice}</code>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommandLink({
  command,
  selected,
  onSelect,
}: {
  command: ToolkitCommand;
  selected: boolean;
  onSelect: (command: ToolkitCommand) => void;
}) {
  return (
    <button
      className={cn('tk-command-link', selected && 'is-selected')}
      onClick={() => onSelect(command)}
      aria-current={selected ? 'page' : undefined}
    >
      <span>
        <code>{command.path || 'uc-storefront'}</code>
        <small>{command.summary}</small>
      </span>
      {command.risks.some((risk) => risk === 'live-write' || risk === 'allocation' || risk === 'query') && (
        <span className="tk-effect-dot" aria-label="Has write, allocation, or query effects" />
      )}
    </button>
  );
}

function CommandBranch({
  command,
  selected,
  onSelect,
  depth = 0,
}: {
  command: ToolkitCommand;
  selected: string;
  onSelect: (command: ToolkitCommand) => void;
  depth?: number;
}) {
  if (!command.group)
    return (
      <li>
        <CommandLink command={command} selected={command.id === selected} onSelect={onSelect} />
      </li>
    );
  const children = toolkitCommandChildren(command.id);
  return (
    <li>
      <details className="tk-branch" open={depth === 0 && command.id === 'sf'}>
        <summary>
          <ChevronRight size={12} />
          <Folder size={13} />
          <span>{command.path.split(' ').at(-1)}</span>
          <small>{children.length}</small>
        </summary>
        <ul>
          <li>
            <button
              className={cn('tk-group-overview', command.id === selected && 'is-selected')}
              aria-current={command.id === selected ? 'page' : undefined}
              onClick={() => onSelect(command)}
            >
              Group overview
            </button>
          </li>
          {children.map((child) => (
            <CommandBranch
              key={child.id}
              command={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

function CommandDetail({
  command,
  onSelect,
}: {
  command: ToolkitCommand;
  onSelect: (command: ToolkitCommand) => void;
}) {
  const children = toolkitCommandChildren(command.id);
  const parents: ToolkitCommand[] = [];
  let parent = toolkitCommands.find((item) => item.id === command.parent);
  while (parent) {
    parents.unshift(parent);
    parent = toolkitCommands.find((item) => item.id === parent?.parent);
  }
  return (
    <article className="tk-article">
      <nav className="tk-breadcrumbs" aria-label="Command hierarchy">
        {parents.map((item) => (
          <span key={item.id}>
            <button onClick={() => onSelect(item)}>{item.path || 'CLI'}</button>
            <ChevronRight size={11} />
          </span>
        ))}
        <span>{command.group ? 'Command group' : 'Command'}</span>
      </nav>
      <div className="tk-detail-heading">
        <div className="tk-detail-icon">
          <Terminal size={22} />
        </div>
        <div>
          <h2>
            <code>{command.path || 'uc-storefront'}</code>
          </h2>
          <p>{command.summary}</p>
        </div>
      </div>
      {!command.group && (
        <div className="tk-effect-list">
          {command.risks.map((risk) => (
            <Badge
              key={risk}
              variant={risk === 'live-write' || risk === 'query' ? 'destructive' : 'secondary'}
              title={toolkitRisks[risk].description}
            >
              {toolkitRisks[risk].label}
            </Badge>
          ))}
          <span>
            {command.network ? <Globe2 size={12} /> : <HardDrive size={12} />}
            {command.network ? 'Uses a remote service' : 'Local interface'}
          </span>
        </div>
      )}
      <section className="tk-section">
        <h3>Command syntax</h3>
        <CopyCode text={toolkitCommandUsage(command)} label="Copy command syntax" />
        <p className="tk-caption">
          Angle brackets mark required values; square brackets mark optional values. Syntax is a reference,
          not a ready-to-run command. Global options are available before the command path.
        </p>
      </section>
      {command.notes.length > 0 && (
        <Alert className="tk-command-notes" role="note">
          <ShieldCheck />
          <AlertTitle>Behavior to know</AlertTitle>
          <AlertDescription>
            <ul>
              {command.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {command.risks.length > 0 && (
        <section className="tk-section">
          <h3>Effects</h3>
          <dl className="tk-effect-definitions">
            {command.risks.map((risk) => (
              <div key={risk}>
                <dt>{toolkitRisks[risk].label}</dt>
                <dd>{toolkitRisks[risk].description}</dd>
              </div>
            ))}
          </dl>
          <p className="tk-caption">
            Effects describe normal execution and optional write flags. Read-only does not mean offline or
            free of private data. Group overviews are not an execution classification.
          </p>
        </section>
      )}
      {children.length > 0 && (
        <section className="tk-section">
          <h3>
            Commands in this group<span>{children.length}</span>
          </h3>
          <div className="tk-child-grid">
            {children.map((child) => (
              <button key={child.id} onClick={() => onSelect(child)}>
                <span>
                  {child.group ? <Folder size={14} /> : <Code2 size={14} />}
                  <code>{child.path}</code>
                  <ChevronRight size={12} />
                </span>
                <small>{child.summary}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <Parameters items={command.arguments} title="Arguments" />
      <Parameters
        items={command.options}
        title={command.id === 'cli' ? 'Global options' : 'Command options'}
      />
      {!command.group && command.options.length === 0 && (
        <p className="tk-caption">
          This command has no command-specific options. Global options and --help still apply.
        </p>
      )}
      {command.id !== 'cli' && (
        <details className="tk-global-options">
          <summary>
            Global options available to this command<span>{toolkitGlobalOptions.length}</span>
          </summary>
          <Parameters items={toolkitGlobalOptions} title="Global options" />
        </details>
      )}
      <section className="tk-section">
        <h3>Check your installed version</h3>
        <CopyCode
          text={`uc-storefront ${command.path ? `${command.path} ` : ''}--help`}
          label="Copy installed help command"
        />
        <p className="tk-caption">
          The bundled reference describes {TOOLKIT_REFERENCE_VERSION}. An external toolkit can differ. Its
          local --help is the authority for that installation. Copying here never runs a command.
        </p>
      </section>
    </article>
  );
}

function GuideDetail({ guide, onCommand }: { guide: ToolkitGuide; onCommand: (id: string) => void }) {
  return (
    <article className="tk-article tk-guide">
      <div className="tk-detail-heading">
        <div className="tk-detail-icon">
          <BookOpen size={22} />
        </div>
        <div>
          <h2>{guide.title}</h2>
          <p>{guide.description}</p>
        </div>
      </div>
      <nav className="tk-guide-index" aria-label="On this page">
        {guide.sections.map((section, index) => (
          <a key={section.title} href={`#tk-guide-${guide.id}-${index}`}>
            {String(index + 1).padStart(2, '0')}
            <span>{section.title}</span>
          </a>
        ))}
      </nav>
      {guide.sections.map((section, index) => (
        <section className="tk-section" key={section.title} id={`tk-guide-${guide.id}-${index}`}>
          <h3>
            <span className="tk-step-number">{String(index + 1).padStart(2, '0')}</span>
            {section.title}
          </h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.code && <CopyCode text={section.code} label={`Copy ${section.title} example`} />}
          {section.commands && (
            <div className="tk-related-commands">
              {section.commands.map((path) => (
                <Button
                  variant="outline"
                  size="sm"
                  key={path}
                  onClick={() => onCommand(path ? path.replaceAll(' ', '.') : 'cli')}
                >
                  <Terminal data-icon="inline-start" />
                  {path || 'Global options'}
                </Button>
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}

function ToolkitSkillContent({
  document,
  skill,
  onFile,
}: {
  document: ToolkitSkillDocument;
  skill: ToolkitSkillSummary;
  onFile: (id: string) => void;
}) {
  if (document.format === 'text')
    return (
      <pre className="tk-skill-text">
        <code>{document.content}</code>
      </pre>
    );
  return (
    <div className="tk-skill-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (resolveToolkitSkillLink(document.path, url, skill.files) ? url : '')}
        components={{
          a: ({ href, children }) => {
            const target = href ? resolveToolkitSkillLink(document.path, href, skill.files) : null;
            return target ? (
              <button className="tk-skill-local-link" onClick={() => onFile(target)}>
                {children}
              </button>
            ) : (
              <span className="tk-skill-inert-link">{children}</span>
            );
          },
          img: ({ alt }) => (
            <span className="tk-skill-image-note">[Image omitted{alt ? `: ${alt}` : ''}]</span>
          ),
        }}
      >
        {document.content}
      </ReactMarkdown>
    </div>
  );
}

function InstalledToolkitSkills({
  controls,
  search,
  installationPath,
  onSettings,
}: {
  controls: ReactNode;
  search: string;
  installationPath?: string;
  onSettings?: () => void;
}) {
  const [index, setIndex] = useState<ToolkitSkillIndex | null>(null);
  const [document, setDocument] = useState<ToolkitSkillDocument | null>(null);
  const [selected, setSelected] = useState<{ skillId: string; fileId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [readFailure, setReadFailure] = useState<string | null>(null);
  const listRequest = useRef(0);
  const readRequest = useRef(0);
  const [findText, setFindText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const docSearchId = useId();
  const load = useCallback(async () => {
    const request = ++listRequest.current;
    ++readRequest.current;
    setLoading(true);
    setFailure(null);
    setDocument(null);
    setReadFailure(null);
    setReading(false);
    try {
      const next = await invoke<ToolkitSkillIndex>('toolkit.skills.list', {});
      if (request !== listRequest.current) return;
      setIndex(next);
      setSelected((current) => {
        const skill = next.skills.find((entry) => entry.id === current?.skillId) || next.skills[0];
        if (!skill) return null;
        const file = skill.files.find((entry) => entry.id === current?.fileId);
        return { skillId: skill.id, fileId: file?.id || skill.entryFileId };
      });
    } catch (error) {
      if (request !== listRequest.current) return;
      setFailure(errorText(error));
      setIndex(null);
      setSelected(null);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      ++listRequest.current;
      ++readRequest.current;
    };
  }, [load, installationPath]);
  useEffect(() => {
    if (loading || !index?.installationId || !selected) return;
    const request = ++readRequest.current;
    setDocument(null);
    setReadFailure(null);
    setReading(true);
    setFindText('');
    setShowRaw(false);
    void invoke<ToolkitSkillDocument>('toolkit.skills.read', {
      installationId: index.installationId,
      skillId: selected.skillId,
      fileId: selected.fileId,
    })
      .then((next) => {
        if (
          request === readRequest.current &&
          next.installationId === index.installationId &&
          next.skillId === selected.skillId &&
          next.fileId === selected.fileId
        )
          setDocument(next);
      })
      .catch((error) => {
        if (request === readRequest.current) setReadFailure(errorText(error));
      })
      .finally(() => {
        if (request === readRequest.current) setReading(false);
      });
    return () => {
      ++readRequest.current;
    };
  }, [index, selected, loading]);
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = (index?.skills || [])
    .map((skill) => {
      const skillMatch = terms.every((term) =>
        `${skill.name} ${skill.description}`.toLowerCase().includes(term)
      );
      return {
        skill,
        files: skill.files.filter(
          (file) =>
            skillMatch || terms.every((term) => `${skill.name} ${file.path}`.toLowerCase().includes(term))
        ),
      };
    })
    .filter((entry) => entry.files.length);
  const skill = index?.skills.find((entry) => entry.id === selected?.skillId);
  const file = skill?.files.find((entry) => entry.id === selected?.fileId);
  const matches = useMemo(() => {
    if (!document || !findText.trim()) return [];
    const query = findText.toLowerCase().trim();
    return document.content
      .split('\n')
      .map((line, at) => ({ line, number: at + 1 }))
      .filter((line) => line.line.toLowerCase().includes(query));
  }, [document, findText]);
  const selectFile = (skillId: string, fileId: string) => {
    ++readRequest.current;
    setDocument(null);
    setSelected({ skillId, fileId });
  };
  return (
    <div className="tk-body">
      <aside className="tk-sidebar" aria-label="Installed toolkit skills">
        {controls}
        <Separator />
        <div className="tk-skill-index-heading">
          <span className="tk-list-caption">INSTALLED SKILLS</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh installed toolkit skills"
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
        <nav className="tk-command-nav" aria-label="Skill files">
          {loading ? (
            <div className="tk-loading" role="status">
              <LoaderCircle size={16} className="animate-spin" />
              Reading toolkit files…
            </div>
          ) : (
            visible.map(({ skill: item, files }) => (
              <div className="tk-skill-nav-group" key={item.id}>
                <button
                  className={cn(
                    'tk-guide-link',
                    selected?.skillId === item.id && selected.fileId === item.entryFileId && 'is-selected'
                  )}
                  onClick={() => selectFile(item.id, item.entryFileId)}
                  aria-current={
                    selected?.skillId === item.id && selected.fileId === item.entryFileId ? 'page' : undefined
                  }
                >
                  <BookOpen size={15} />
                  <span>
                    {item.name}
                    <small>{item.description}</small>
                    <small>{item.files.length} instruction and reference files</small>
                  </span>
                </button>
                {(selected?.skillId === item.id || terms.length > 0) && (
                  <ul className="tk-skill-files">
                    {files.map((entry) => (
                      <li key={entry.id}>
                        <button
                          className={cn(
                            selected?.skillId === item.id && selected.fileId === entry.id && 'is-selected'
                          )}
                          aria-current={
                            selected?.skillId === item.id && selected.fileId === entry.id ? 'page' : undefined
                          }
                          onClick={() => selectFile(item.id, entry.id)}
                        >
                          <FileText size={12} />
                          <span>{entry.path}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
          {!loading && index?.status === 'ready' && !visible.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No matching skill files</EmptyTitle>
                <EmptyDescription>Search a skill name, description, or reference filename.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </nav>
        <div className="tk-sidebar-footer">
          <HardDrive size={14} />
          <span>
            {index?.packageVersion ? `Installed toolkit ${index.packageVersion}. ` : ''}Files are read from
            your external installation. Instructions are displayed, never executed.
          </span>
        </div>
      </aside>
      <main className="tk-content">
        {loading ? (
          <div className="tk-loading tk-skill-empty" role="status">
            <LoaderCircle size={20} className="animate-spin" />
            Loading installed skills…
          </div>
        ) : failure || index?.status !== 'ready' ? (
          <Empty className="tk-skill-empty">
            <EmptyHeader>
              <EmptyMedia>
                <Folder />
              </EmptyMedia>
              <EmptyTitle>Connect a toolkit to browse its skills</EmptyTitle>
              <EmptyDescription>
                {failure ||
                  index?.issues.join(' ') ||
                  'Configure an authorized external toolkit installation to read its packaged skills. The command and capability reference remains available offline.'}
              </EmptyDescription>
            </EmptyHeader>
            {onSettings && (
              <Button variant="outline" onClick={onSettings}>
                <Settings2 data-icon="inline-start" />
                Configure toolkit
              </Button>
            )}
          </Empty>
        ) : !skill ? (
          <Empty className="tk-skill-empty">
            <EmptyHeader>
              <EmptyMedia>
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>No skill files found</EmptyTitle>
              <EmptyDescription>
                This toolkit installation does not expose a readable skill entry. Check the installation and
                refresh.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <article className="tk-article tk-skill-article">
            <div className="tk-breadcrumbs">
              <span>Installed toolkit {index.packageVersion || 'unknown version'}</span>
              <ChevronRight size={11} />
              <span>{skill.name}</span>
            </div>
            <div className="tk-detail-heading">
              <div className="tk-detail-icon">
                <BookOpen size={22} />
              </div>
              <div>
                <h2>{file?.path || 'Skill instructions'}</h2>
                <p>{skill.description}</p>
              </div>
            </div>
            <div className="tk-effect-list">
              <Badge variant="secondary">Local file</Badge>
              {file && <span>{new Intl.NumberFormat().format(file.bytes)} bytes</span>}
              <span>Full file · Read only</span>
            </div>
            {index.issues.length > 0 && (
              <Alert role="note" className="tk-command-notes">
                <ShieldCheck />
                <AlertTitle>Some files could not be indexed</AlertTitle>
                <AlertDescription>{index.issues.join(' ')}</AlertDescription>
              </Alert>
            )}
            {reading ? (
              <div className="tk-loading" role="status">
                <LoaderCircle size={18} className="animate-spin" />
                Reading selected file…
              </div>
            ) : readFailure ? (
              <Alert variant="destructive" className="tk-command-notes">
                <AlertTitle>Could not read this file</AlertTitle>
                <AlertDescription>
                  {readFailure}
                  <Button variant="outline" size="sm" onClick={() => void load()}>
                    Refresh installation
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              document && (
                <>
                  <div className="tk-skill-tools">
                    <Field>
                      <FieldLabel htmlFor={docSearchId} className="sr-only">
                        Find text in this file
                      </FieldLabel>
                      <Input
                        id={docSearchId}
                        value={findText}
                        onChange={(event) => setFindText(event.target.value)}
                        placeholder="Find text in this file…"
                      />
                    </Field>
                    <ToggleGroup
                      type="single"
                      value={showRaw ? 'source' : 'formatted'}
                      onValueChange={(value) => {
                        if (value) setShowRaw(value === 'source');
                      }}
                      size="sm"
                      variant="outline"
                      aria-label="Instruction format"
                    >
                      <ToggleGroupItem value="formatted">Read</ToggleGroupItem>
                      <ToggleGroupItem value="source">Source</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {findText.trim() && (
                    <section className="tk-skill-find" aria-label="Text search results">
                      <span role="status">{matches.length} matching lines</span>
                      <div>
                        {matches.slice(0, 100).map((match) => (
                          <p key={match.number}>
                            <small>Line {match.number}</small>
                            <code>{match.line}</code>
                          </p>
                        ))}
                      </div>
                      {matches.length > 100 && (
                        <small>Showing the first 100 matches. The complete file remains below.</small>
                      )}
                    </section>
                  )}
                  <p className="tk-caption">
                    References open only when they match a listed local file. External links, embedded HTML,
                    and images are not loaded. Reading these instructions does not authorize or run them.
                  </p>
                  <Separator />
                  {showRaw ? (
                    <pre className="tk-skill-text">
                      <code>{document.content}</code>
                    </pre>
                  ) : (
                    <ToolkitSkillContent
                      document={document}
                      skill={skill}
                      onFile={(id) => selectFile(skill.id, id)}
                    />
                  )}
                </>
              )
            )}
          </article>
        )}
      </main>
    </div>
  );
}

export function ToolkitReference({ boot, onSettings }: { boot?: Bootstrap; onSettings?: () => void }) {
  const searchId = useId();
  const effectId = useId();
  const [mode, setMode] = useState<ReferenceMode>('commands');
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState<ToolkitRisk | ''>('');
  const [commandId, setCommandId] = useState('cli');
  const [guideId, setGuideId] = useState('overview');
  const commands = useMemo(() => searchToolkitCommands(search, risk || undefined), [search, risk]);
  const guides = useMemo(
    () =>
      toolkitGuides.filter((guide) =>
        search
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .every((term) =>
            [
              guide.title,
              guide.description,
              ...guide.sections.flatMap((section) => [
                section.title,
                ...section.paragraphs,
                ...(section.commands || []),
              ]),
            ]
              .join(' ')
              .toLowerCase()
              .includes(term)
          )
      ),
    [search]
  );
  const command = toolkitCommands.find((item) => item.id === commandId) || toolkitCommands[0];
  const guide = toolkitGuides.find((item) => item.id === guideId) || toolkitGuides[0];
  const selectCommand = (item: ToolkitCommand) => {
    setCommandId(item.id);
    setMode('commands');
  };
  const filtered = Boolean(search.trim() || risk);
  const controls = (
    <>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (value) {
            setMode(value as ReferenceMode);
            setSearch('');
          }
        }}
        size="sm"
        variant="outline"
        aria-label="Reference section"
      >
        <ToggleGroupItem value="commands">Commands</ToggleGroupItem>
        <ToggleGroupItem value="capabilities">Capabilities</ToggleGroupItem>
        <ToggleGroupItem value="skills">Skills</ToggleGroupItem>
      </ToggleGroup>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={searchId} className="sr-only">
            Search {mode}
          </FieldLabel>
          <div className="tk-search">
            <Search size={15} />
            <Input
              id={searchId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                mode === 'commands'
                  ? 'Search commands and flags…'
                  : mode === 'skills'
                    ? 'Search skills and files…'
                    : 'Search capabilities…'
              }
            />
          </div>
        </Field>
        {mode === 'commands' && (
          <Field orientation="horizontal">
            <FieldLabel htmlFor={effectId}>Effect</FieldLabel>
            <select
              id={effectId}
              value={risk}
              onChange={(event) => setRisk(event.target.value as ToolkitRisk | '')}
            >
              <option value="">All effects</option>
              {Object.entries(toolkitRisks).map(([value, entry]) => (
                <option key={value} value={value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </FieldGroup>
    </>
  );
  return (
    <div className="tk-screen">
      <header className="tk-header">
        <div>
          <span className="tk-eyebrow">ULTRACART AGENT TOOLKIT</span>
          <h1>Toolkit reference</h1>
          <p>Explore commands, understand their effects, and read the toolkit’s installed skills.</p>
        </div>
        {onSettings && (
          <Button variant="outline" size="sm" onClick={onSettings}>
            <Settings2 data-icon="inline-start" />
            Configure toolkit
          </Button>
        )}
      </header>
      <div className="tk-overview">
        <div>
          <BookOpen size={17} />
          <span>
            <strong>{toolkitCommands.filter((item) => !item.group).length} commands</strong>
            <small>Complete registered command hierarchy</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={17} />
          <span>
            <strong>Read-only reference</strong>
            <small>No commands run from this page</small>
          </span>
        </div>
        <div>
          <Terminal size={17} />
          <span>
            <strong>Toolkit {TOOLKIT_REFERENCE_VERSION}</strong>
            <small>Command snapshot · {TOOLKIT_REFERENCE_DATE}</small>
          </span>
        </div>
      </div>
      {mode === 'skills' ? (
        <InstalledToolkitSkills
          key={boot?.settings.cliPath || 'unconfigured'}
          controls={controls}
          search={search}
          installationPath={boot?.settings.cliPath}
          onSettings={onSettings}
        />
      ) : (
        <div className="tk-body">
          <aside className="tk-sidebar" aria-label="Reference navigation">
            {controls}
            <Separator />
            <nav
              className="tk-command-nav"
              aria-label={mode === 'commands' ? 'CLI commands' : 'Toolkit capabilities'}
            >
              {mode === 'commands' ? (
                <>
                  <div className="tk-list-caption" aria-live="polite">
                    {filtered ? `${commands.length} matches` : 'COMMAND HIERARCHY'}
                  </div>
                  {filtered ? (
                    commands.map((item) => (
                      <CommandLink
                        key={item.id}
                        command={item}
                        selected={item.id === commandId}
                        onSelect={selectCommand}
                      />
                    ))
                  ) : (
                    <>
                      <CommandLink
                        command={toolkitCommands[0]}
                        selected={commandId === 'cli'}
                        onSelect={selectCommand}
                      />
                      <ul>
                        {toolkitCommandChildren('cli').map((item) => (
                          <CommandBranch
                            key={item.id}
                            command={item}
                            selected={commandId}
                            onSelect={selectCommand}
                          />
                        ))}
                      </ul>
                    </>
                  )}
                  {filtered && commands.length === 0 && (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia>
                          <Search />
                        </EmptyMedia>
                        <EmptyTitle>No matching commands</EmptyTitle>
                        <EmptyDescription>
                          Try a command, flag, target, or a different effect filter.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </>
              ) : (
                <>
                  {guides.map((item) => (
                    <button
                      key={item.id}
                      className={cn('tk-guide-link', item.id === guideId && 'is-selected')}
                      aria-current={item.id === guideId ? 'page' : undefined}
                      onClick={() => setGuideId(item.id)}
                    >
                      <Workflow size={15} />
                      <span>
                        {item.title}
                        <small>{item.description}</small>
                      </span>
                      <ChevronRight size={12} />
                    </button>
                  ))}
                  {guides.length === 0 && (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No matching capabilities</EmptyTitle>
                        <EmptyDescription>Try a shorter phrase or switch sections.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </>
              )}
            </nav>
            <div className="tk-sidebar-footer">
              <FileText size={14} />
              <span>Authored interface guide. Private toolkit code and merchant data are not bundled.</span>
            </div>
          </aside>
          <main className="tk-content" key={mode === 'commands' ? command.id : guide.id}>
            {mode === 'commands' ? (
              <CommandDetail command={command} onSelect={selectCommand} />
            ) : (
              <GuideDetail
                guide={guide}
                onCommand={(id) => {
                  setCommandId(id);
                  setMode('commands');
                  setSearch('');
                  setRisk('');
                }}
              />
            )}
            <footer className="tk-content-footer">
              <span>Understand what the toolkit can do</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('capabilities');
                  setGuideId('overview');
                  setSearch('');
                }}
              >
                Explore capabilities
                <ChevronRight data-icon="inline-end" />
              </Button>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
