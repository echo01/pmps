import { TemplateItem } from '../../api/qc.api';

export type ResultDraft = {
  measured_value: string;
  measured_text: string;
  remark: string;
};

type Props = {
  item: TemplateItem;
  value: ResultDraft;
  onChange: (value: ResultDraft) => void;
};

export function ResultInputCell({ item, value, onChange }: Props) {
  const checkType = (item.check_type || '').toUpperCase();

  if (checkType === 'NUMERIC') {
    return (
      <input
        inputMode="decimal"
        placeholder="Value"
        value={value.measured_value}
        onChange={(event) => onChange({ ...value, measured_value: event.target.value, measured_text: '' })}
      />
    );
  }

  if (checkType === 'BOOLEAN') {
    return (
      <select
        value={value.measured_text}
        onChange={(event) => onChange({ ...value, measured_value: '', measured_text: event.target.value })}
      >
        <option value="">N/A</option>
        <option value="OK">OK / PASS</option>
        <option value="NG">NG / FAIL</option>
        <option value="YES">YES</option>
        <option value="NO">NO</option>
      </select>
    );
  }

  return (
    <input
      placeholder="Text"
      value={value.measured_text}
      onChange={(event) => onChange({ ...value, measured_value: '', measured_text: event.target.value })}
    />
  );
}
