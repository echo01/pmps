import { CheckCircle2, Send, ThumbsDown, UserCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { StatusBadge } from '../badges/StatusBadge';

type Props = {
  status?: string | null;
  disabled?: boolean;
  busy?: boolean;
  onSubmit: (remark?: string) => void;
  onReview: (remark?: string) => void;
  onApprove: (remark?: string) => void;
  onReject: (remark: string) => void;
};

export function ApprovalActions({ status, disabled, busy, onSubmit, onReview, onApprove, onReject }: Props) {
  const [remark, setRemark] = useState('');
  const normalized = (status || '').toUpperCase();
  const canSubmit = normalized === 'DRAFT' || normalized === 'EDIT_APPLIED';
  const canReview = normalized === 'SUBMITTED';
  const canApprove = normalized === 'REVIEWED';
  const canReject = normalized === 'SUBMITTED' || normalized === 'REVIEWED';

  function reject(event: FormEvent) {
    event.preventDefault();
    if (remark.trim()) onReject(remark.trim());
  }

  return (
    <div className="approvalActions">
      <div>
        <span className="eyebrow">Workflow Status</span>
        <div><StatusBadge value={status || 'NEW'} /></div>
      </div>
      <label className="workflowRemark">
        Remark
        <input value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Optional except reject" />
      </label>
      <button className="textButton" disabled={disabled || busy || !canSubmit} onClick={() => onSubmit(remark)}>
        <Send size={16} /> Submit
      </button>
      <button className="textButton" disabled={disabled || busy || !canReview} onClick={() => onReview(remark)}>
        <UserCheck size={16} /> Review
      </button>
      <button className="primaryButton" disabled={disabled || busy || !canApprove} onClick={() => onApprove(remark)}>
        <CheckCircle2 size={16} /> Approve
      </button>
      <form onSubmit={reject}>
        <button className="dangerButton" disabled={disabled || busy || !canReject || !remark.trim()} type="submit">
          <ThumbsDown size={16} /> Reject
        </button>
      </form>
    </div>
  );
}
