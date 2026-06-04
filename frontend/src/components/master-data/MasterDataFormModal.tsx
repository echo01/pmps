import { ReactNode } from 'react';
import { ErrorAlert } from '../common/ErrorAlert';

type MasterDataFormModalProps = {
  open: boolean;
  title: string;
  submitLabel?: string;
  saving?: boolean;
  error?: unknown;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
};

export function MasterDataFormModal({
  open,
  title,
  submitLabel = 'Save',
  saving,
  error,
  children,
  onClose,
  onSubmit,
}: MasterDataFormModalProps) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="modalPanel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton" type="button" onClick={onClose} aria-label="Close">x</button>
        </div>
        {error ? <ErrorAlert error={error} title="Unable to save" /> : null}
        <div className="formStack">{children}</div>
        <div className="modalActions">
          <button className="textButton" type="button" onClick={onClose}>Cancel</button>
          <button className="primaryButton" type="button" onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
