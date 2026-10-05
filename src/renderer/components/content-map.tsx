import { useEffect, useState } from 'react';
import { ArrowUpRight, FileCode2, Layers3, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ContentMap as ContentMapResult } from '../../shared/content-map';
import { errorText, invoke } from '../api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { EmptyState } from './common';
import './content-map.css';

export function ContentMap({
  path,
  slot,
  onSelectSlot,
}: {
  path: string;
  slot: string;
  onSelectSlot: (slot: string) => void;
}) {
  const [result, setResult] = useState<ContentMapResult | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let valid = true;
    setBusy(true);
    setError('');
    setResult(null);
    void invoke<ContentMapResult>('page.contentMap', { path })
      .then((value) => {
        if (valid) setResult(value);
      })
      .catch((error) => {
        if (valid) setError(errorText(error));
      })
      .finally(() => {
        if (valid) setBusy(false);
      });
    return () => {
      valid = false;
    };
  }, [path, version]);
  return (
    <section className="content-map">
      <header className="content-map-heading">
        <div>
          <span className="eyebrow">PAGE ANATOMY</span>
          <h2>Where this page gets its content</h2>
          <p>Inspect the template and its reachable containers. Choose a page slot to edit.</p>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setVersion((v) => v + 1)}>
          {busy ? <LoaderCircle className="spin" /> : <RefreshCw />} Refresh map
        </Button>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {busy && (
        <div className="content-map-loading">
          <LoaderCircle className="spin" />
          Reading template and container references…
        </div>
      )}
      {result && (
        <>
          <div className="content-map-template">
            <FileCode2 size={18} />
            <div>
              <span>Resolved group template</span>
              <code>{result.template}</code>
            </div>
            <Badge variant="outline">{result.sample ? 'Sample' : `Theme ${result.themeId}`}</Badge>
          </div>
          <div className="content-map-section-label">
            <Layers3 size={15} />
            <h3>Page slots</h3>
            <span>Edits apply to this page</span>
          </div>
          <div className="content-map-sources">
            {result.sources
              .filter((source) => source.slot !== null)
              .map((source) => (
                <article key={source.file} className={source.slot === slot ? 'selected' : ''}>
                  <div>
                    <div className="content-map-name">
                      <strong>{source.slot}</strong>
                      {source.slot === slot && <Badge variant="secondary">Selected</Badge>}
                    </div>
                    <code>{source.file}</code>
                    <details>
                      <summary>Reference path</summary>
                      {source.via.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </details>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onSelectSlot(source.slot!)}>
                    Edit slot <ArrowUpRight />
                  </Button>
                </article>
              ))}
            {!result.sources.some((source) => source.slot !== null) && (
              <EmptyState
                title="No page slot was found"
                description="The template may use shared content, item containers, or dynamic includes. Review the limits below."
              />
            )}
          </div>
          {result.sources.some((source) => source.slot === null) && (
            <>
              <div className="content-map-section-label">
                <FileCode2 size={15} />
                <h3>Shared containers</h3>
                <span>Read-only context</span>
              </div>
              <div className="content-map-sources shared">
                {result.sources
                  .filter((source) => source.slot === null)
                  .map((source) => (
                    <article key={source.file}>
                      <div>
                        <code>{source.file}</code>
                        <details>
                          <summary>Reference path</summary>
                          {source.via.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </details>
                      </div>
                      <Badge variant="outline">Shared theme</Badge>
                    </article>
                  ))}
              </div>
            </>
          )}
          <div className="content-map-limits">
            <h3>Inspection scope</h3>
            <p>
              Literal template includes are followed. A conditional include can appear here without being
              visible on the page. Shared containers can affect other pages. Item containers and dynamic
              includes may need separate inspection.
            </p>
            {[...result.warnings, ...result.notFollowed].length > 0 && (
              <details open={result.notFollowed.length > 0}>
                <summary>
                  {result.warnings.length + result.notFollowed.length} notes and unresolved references
                </summary>
                <ul>
                  {[...result.warnings, ...result.notFollowed].map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </>
      )}
    </section>
  );
}
