type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, confirming, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="modalPanel confirmPanel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton" type="button" onClick={onCancel} aria-label="Close">x</button>
        </div>
        <p className="mutedText">{message}</p>
        <div className="modalActions">
          <button className="textButton" type="button" onClick={onCancel}>Cancel</button>
          <button className="dangerButton" type="button" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </section>
    </div>
  );
}
