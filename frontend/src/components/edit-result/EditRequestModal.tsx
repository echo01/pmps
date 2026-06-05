import { FormEvent, useState } from 'react';
import { ErrorAlert } from '../common/ErrorAlert';

type Props = {
  open: boolean;
  title?: string;
  busy?: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

export function EditRequestModal({ open, title = 'Request Edit Result', busy, error, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setFieldError('reason is required');
      return;
    }

    setFieldError('');
    onSubmit(reason.trim());
  }

  return (
    <div className="modalBackdrop">
      <form className="modalPanel confirmPanel" onSubmit={submit}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="textButton" type="button" onClick={onClose}>Close</button>
        </div>
        {error ? <ErrorAlert error={error} title="Unable to request edit" /> : null}
        <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter reason for editing approved result" /></label>
        {fieldError ? <small className="fieldError">{fieldError}</small> : null}
        <div className="modalActions">
          <button className="textButton" type="button" onClick={onClose}>Cancel</button>
          <button className="primaryButton" disabled={busy} type="submit">Submit Request</button>
        </div>
      </form>
    </div>
  );
}

