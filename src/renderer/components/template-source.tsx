import { useMemo, useState } from 'react';
import { Code2, Search } from 'lucide-react';
import type { TemplateSource } from '../../shared/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export function TemplateSourceDialog({ source, onClose }: { source: TemplateSource; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const lines = useMemo(() => source.content.split('\n'), [source.content]);
  const needle = query.trim().toLowerCase();
  const matches = needle ? lines.filter((line) => line.toLowerCase().includes(needle)).length : 0;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="source-dialog">
        <DialogHeader>
          <DialogTitle className="source-title">
            <Code2 size={18} /> Template source <Badge variant="secondary">Read only</Badge>
          </DialogTitle>
          <DialogDescription>
            The resolved {source.kind} template for this page. Included files are not expanded.
          </DialogDescription>
        </DialogHeader>
        <div className="source-toolbar">
          <code title={source.path}>{source.path}</code>
          <div>
            <Search size={14} />
            <Input
              aria-label="Find in template"
              placeholder="Find in template..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="source-code" tabIndex={0} aria-label="Read-only template source">
          {lines.map((line, index) => (
            <div
              key={index}
              className={needle && line.toLowerCase().includes(needle) ? 'source-match' : undefined}
            >
              <span aria-hidden="true">{index + 1}</span>
              <code>{line || ' '}</code>
            </div>
          ))}
        </div>
        <div className="source-footer">
          <span>
            {lines.length.toLocaleString()} lines{needle ? ` · ${matches} matching lines` : ''}
          </span>
          <span>
            {source.truncated ? 'Partial content. Source exceeded the read limit.' : 'Current server content'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
