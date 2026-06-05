import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { profileApi } from '../../api/profile.api';
import { ErrorAlert } from '../../components/common/ErrorAlert';

export function ChangePasswordPage() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => profileApi.changePassword(form),
    onSuccess: () => {
      setSuccess(true);
      setLocalError(null);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    },
  });

  function submit() {
    if (!form.current_password) return setLocalError('Current password is required');
    if (form.new_password.length < 8) return setLocalError('New password must be at least 8 characters');
    if (form.new_password !== form.confirm_password) return setLocalError('Password confirmation does not match');
    setLocalError(null);
    setSuccess(false);
    saveMutation.mutate();
  }

  return (
    <div className="pageStack">
      <div>
        <Link className="backLink" to="/profile"><ArrowLeft size={16} /> Back to Profile</Link>
        <span className="eyebrow">Account</span>
        <h1>Change Password</h1>
      </div>

      {localError ? <ErrorAlert error={new Error(localError)} title="Unable to change password" /> : null}
      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to change password" /> : null}
      {success ? <div className="alert success"><strong>Password changed successfully</strong><span>Please use the new password next time you sign in.</span></div> : null}

      <section className="panel formStack securityForm">
        <label>Current Password<input type="password" value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.target.value })} /></label>
        <label>New Password<input type="password" value={form.new_password} onChange={(event) => setForm({ ...form, new_password: event.target.value })} /></label>
        <label>Confirm New Password<input type="password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} /></label>
        <div className="formActions">
          <button className="primaryButton" type="button" disabled={saveMutation.isPending} onClick={submit}>
            <KeyRound size={16} /> {saveMutation.isPending ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </section>
    </div>
  );
}
