import { FormEvent, useEffect, useState } from 'react';
import { ApprovedResultEditPayload, TemplateItem } from '../../api/qc.api';
import { ErrorAlert } from '../common/ErrorAlert';
import { buildChangedEditItems, buildEditDrafts, EditResultGrid } from './EditResultGrid';
import { EditResultDetail, EditResultDraft } from './editResultTypes';

type Props = {
  sourceLabel: string;
  details: EditResultDetail[];
  templates: TemplateItem[];
  busy?: boolean;
  error?: unknown;
  onApply: (payload: ApprovedResultEditPayload) => void;
};

export function ApplyEditPanel({ sourceLabel, details, templates, busy, error, onApply }: Props) {
  const [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState<Record<number, EditResultDraft>>({});
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    setDrafts(buildEditDrafts(details));
    setFieldError('');
    setReason('');
  }, [details]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const items = buildChangedEditItems(details, drafts);

    if (!reason.trim()) {
      setFieldError('reason is required');
      return;
    }

    if (!items.length) {
      setFieldError('At least one item must be changed');
      return;
    }

    setFieldError('');
    onApply({ reason: reason.trim(), items });
  }

  return (
    <section className="panel editApplyPanel">
      <div className="sectionHeader">
        <div>
          <h2>Apply Edited Result</h2>
          <p className="mutedText">{sourceLabel} will return to SUBMITTED after apply edit.</p>
        </div>
      </div>
      {error ? <ErrorAlert error={error} title="Unable to apply edit" /> : null}
      <form className="pageStack" onSubmit={submit}>
        <EditResultGrid details={details} templates={templates} drafts={drafts} onChange={(detailId, value) => setDrafts({ ...drafts, [detailId]: value })} />
        <label>Apply Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why these edited values are being applied" /></label>
        {fieldError ? <small className="fieldError">{fieldError}</small> : null}
        <div className="formActions">
          <button className="primaryButton" disabled={busy} type="submit">Apply Edit</button>
        </div>
      </form>
    </section>
  );
}

