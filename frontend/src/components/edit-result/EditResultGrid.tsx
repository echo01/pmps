import { useMemo } from 'react';
import { StatusBadge } from '../badges/StatusBadge';
import { ResultDraft } from '../transaction/ResultInputCell';
import { calculatePreviewResult } from '../../utils/resultPreview';
import { EditResultDetail, EditResultDraft, mergeDetailWithTemplate } from './editResultTypes';
import { TemplateItem } from '../../api/qc.api';

type Props = {
  details: EditResultDetail[];
  templates: TemplateItem[];
  drafts: Record<number, EditResultDraft>;
  onChange: (detailId: number, value: EditResultDraft) => void;
};

function oldValue(detail: EditResultDetail) {
  return (detail.check_type || '').toUpperCase() === 'NUMERIC'
    ? detail.measured_value ?? ''
    : detail.measured_text ?? '';
}

function specText(item: ReturnType<typeof mergeDetailWithTemplate>) {
  if (item.spec_min !== null && item.spec_min !== undefined && item.spec_max !== null && item.spec_max !== undefined) return `${item.spec_min} - ${item.spec_max}`;
  return item.unit || '-';
}

function defaultDraft(detail: EditResultDetail): EditResultDraft {
  return {
    measured_value: detail.measured_value === null || detail.measured_value === undefined ? '' : String(detail.measured_value),
    measured_text: detail.measured_text || '',
    remark: detail.remark || '',
    changed: false,
  };
}

export function buildEditDrafts(details: EditResultDetail[]) {
  return Object.fromEntries(details.map((detail) => [detail.id, defaultDraft(detail)]));
}

export function buildChangedEditItems(details: EditResultDetail[], drafts: Record<number, EditResultDraft>) {
  return details
    .filter((detail) => drafts[detail.id]?.changed)
    .map((detail) => {
      const draft = drafts[detail.id] || defaultDraft(detail);
      const checkType = (detail.check_type || '').toUpperCase();
      return {
        detail_id: detail.id,
        measured_value: checkType === 'NUMERIC' && draft.measured_value.trim() !== '' ? Number(draft.measured_value) : null,
        measured_text: checkType === 'NUMERIC' ? null : (draft.measured_text.trim() || null),
        remark: draft.remark.trim() || null,
      };
    });
}

export function EditResultGrid({ details, templates, drafts, onChange }: Props) {
  const templateById = useMemo(() => new Map(templates.map((item) => [item.id, item])), [templates]);

  return (
    <div className="tableScroll">
      <table className="editResultTable">
        <thead>
          <tr><th>Sample</th><th>Item</th><th>Check</th><th>Spec</th><th>Old Value</th><th>New Value</th><th>Old Result</th><th>New Preview</th><th>Remark</th></tr>
        </thead>
        <tbody>
          {details.map((detail) => {
            const draft = drafts[detail.id] || defaultDraft(detail);
            const item = mergeDetailWithTemplate(detail, templateById.get(detail.template_item_id));
            const checkType = (detail.check_type || '').toUpperCase();
            const preview = calculatePreviewResult({
              ...item,
              measured_value: checkType === 'NUMERIC' ? draft.measured_value : null,
              measured_text: checkType === 'NUMERIC' ? null : draft.measured_text,
            });

            return (
              <tr key={detail.id}>
                <td>{detail.sample_label || detail.serial_number || '-'}</td>
                <td><strong>{detail.item_code}</strong><br /><span className="mutedText">{detail.item_name}</span></td>
                <td>{detail.check_type}</td>
                <td>{specText(item)}</td>
                <td>{oldValue(detail) || '-'}</td>
                <td>
                  {checkType === 'NUMERIC' ? (
                    <input value={draft.measured_value} onChange={(event) => onChange(detail.id, { ...draft, measured_value: event.target.value, changed: true })} />
                  ) : (
                    <input value={draft.measured_text} onChange={(event) => onChange(detail.id, { ...draft, measured_text: event.target.value, changed: true })} />
                  )}
                </td>
                <td><StatusBadge value={detail.result || 'N/A'} /></td>
                <td><StatusBadge value={preview} /></td>
                <td><input value={draft.remark} onChange={(event) => onChange(detail.id, { ...draft, remark: event.target.value, changed: true })} placeholder="Remark" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

