import { StatusBadge } from '../badges/StatusBadge';

type Props = {
  status?: string | null;
  latestReason?: string | null;
};

export function EditStatusBanner({ status, latestReason }: Props) {
  if (status !== 'EDIT_REQUESTED') return null;

  return (
    <div className="editStatusBanner">
      <div>
        <strong>Edit requested</strong>
        <span>This record is waiting for edited result values. Apply edit will return it to SUBMITTED for review and approval again.</span>
      </div>
      <StatusBadge value="EDIT_REQUESTED" />
      {latestReason ? <p>Reason: {latestReason}</p> : null}
    </div>
  );
}

