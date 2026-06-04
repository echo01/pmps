import { StatusBadge } from '../badges/StatusBadge';
import { TemplateItem } from '../../api/qc.api';
import { calculatePreviewResult } from '../../utils/resultPreview';
import { ResultDraft, ResultInputCell } from './ResultInputCell';

type Props = {
  items: TemplateItem[];
  values: Record<number, ResultDraft>;
  onChange: (itemId: number, value: ResultDraft) => void;
};

export function ResultGrid({ items, values, onChange }: Props) {
  return (
    <div className="tableScroll">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Check</th>
            <th>Spec</th>
            <th>Result Input</th>
            <th>Preview</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const value = values[item.id] || { measured_value: '', measured_text: '', remark: '' };
            const preview = calculatePreviewResult({ ...item, ...value });

            return (
              <tr key={item.id}>
                <td>
                  <strong>{item.item_code}</strong>
                  <div className="mutedText">{item.item_name}</div>
                </td>
                <td>{item.check_type}</td>
                <td>{item.spec_min ?? '-'} - {item.spec_max ?? '-'} {item.unit || ''}</td>
                <td><ResultInputCell item={item} value={value} onChange={(next) => onChange(item.id, next)} /></td>
                <td><StatusBadge value={preview} /></td>
                <td>
                  <input
                    value={value.remark}
                    placeholder="Remark"
                    onChange={(event) => onChange(item.id, { ...value, remark: event.target.value })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
