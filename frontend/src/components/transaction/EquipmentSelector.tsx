import { useQuery } from '@tanstack/react-query';
import { modelRequiredEquipmentApi } from '../../api/modelRequiredEquipment.api';
import { StatusBadge } from '../badges/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { ErrorAlert } from '../common/ErrorAlert';
import { LoadingPanel } from '../common/LoadingPanel';
import { formatDate } from '../../utils/dateFormat';

type Props = {
  modelId?: number | null;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function EquipmentSelector({ modelId, selectedIds, onChange }: Props) {
  const query = useQuery({
    queryKey: ['transaction-equipment', modelId],
    queryFn: () => modelRequiredEquipmentApi.getAvailableEquipmentByModel(modelId || 0),
    enabled: Boolean(modelId),
  });

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  if (!modelId) return <EmptyState message="Select lot before selecting equipment" />;
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data?.length) return <EmptyState message="No available equipment for this model" />;

  return (
    <div className="tableScroll">
      <table>
        <thead>
          <tr><th>Select</th><th>Equipment</th><th>Type</th><th>Status</th><th>Calibration</th><th>Required</th></tr>
        </thead>
        <tbody>
          {query.data.map((row) => (
            <tr key={row.equipment_id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.equipment_id)}
                  onChange={() => toggle(row.equipment_id)}
                  aria-label={`Select ${row.equipment_code}`}
                />
              </td>
              <td>{row.equipment_code} - {row.equipment_name}</td>
              <td>{row.equipment_type_code}</td>
              <td><StatusBadge value={row.status} /></td>
              <td><StatusBadge value={row.calibration_status} /> {formatDate(row.calibration_due_date)}</td>
              <td>{row.required_qty} {row.mandatory ? 'Mandatory' : 'Optional'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
