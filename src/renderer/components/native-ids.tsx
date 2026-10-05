import { useEffect, useState } from 'react';
import { KeyRound, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Draft } from '../../shared/drafts';
import type { WidgetIdPlan } from '../../shared/widget-ids';
import { errorText, invoke } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, FieldLabel } from './ui/field';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export function NativeIdsDialog({
  draft,
  host,
  onClose,
  onSaved,
}: {
  draft: Draft;
  host: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [plan, setPlan] = useState<WidgetIdPlan | null>(null);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const target = { path: draft.path, slot: draft.slot, id: draft.id, revision: draft.revision };
  useEffect(() => {
    let valid = true;
    void invoke<WidgetIdPlan>('draft.nativeIdsPlan', target)
      .then((value) => {
        if (valid) setPlan(value);
      })
      .catch((error) => {
        if (valid) setError(errorText(error));
      });
    return () => {
      valid = false;
    };
  }, [draft.id, draft.revision]);
  async function reserve() {
    setBusy(true);
    setError('');
    try {
      await invoke('draft.reserveNativeIds', { ...target, confirmedHost: confirmation });
      await onSaved();
      toast.success('Native IDs saved. Review and preview this revision before publishing.');
      onClose();
    } catch (error) {
      setError(errorText(error));
      setPlan(await invoke<WidgetIdPlan>('draft.nativeIdsPlan', target).catch(() => null));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare native widget IDs</DialogTitle>
          <DialogDescription>
            Added sections have local IDs. This action reserves IDs from {host} and saves a new local
            revision. It does not publish content.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {plan && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{plan.count}</strong> new IDs · {plan.existingCount} existing widget IDs preserved ·{' '}
              {plan.batchCount} allocation request{plan.batchCount === 1 ? '' : 's'}
            </p>
            <p className="text-muted-foreground">
              Allocation receipts stay on this device. Interrupted requests are not repeated automatically.
              Reserving IDs cannot be undone.
            </p>
            {plan.receipt && (
              <p>
                Receipt: <code>{plan.receipt.id}</code>
                <br />
                Status: {plan.receipt.status}
              </p>
            )}
            {plan.reason && <p>{plan.reason}</p>}
            <Field>
              <FieldLabel htmlFor="native-id-host">Type {host} to confirm</FieldLabel>
              <Input
                id="native-id-host"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
              />
            </Field>
          </div>
        )}
        {!plan && !error && <LoaderCircle className="spin" />}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              !plan ||
              (!plan.canReserve && plan.receipt?.status !== 'complete') ||
              confirmation !== host
            }
            onClick={() => void reserve()}
          >
            {busy ? <LoaderCircle className="spin" /> : <KeyRound />}{' '}
            {plan?.receipt?.status === 'complete' ? 'Apply reserved IDs' : 'Reserve native IDs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
