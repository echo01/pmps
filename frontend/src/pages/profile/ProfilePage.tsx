import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileApi } from '../../api/profile.api';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', email: '' });

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.getProfile(),
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: profile.data.full_name || '',
        email: profile.data.email || '',
      });
    }
  }, [profile.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      profileApi.updateProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Account</span>
          <h1>My Profile</h1>
        </div>
        <Link className="textButton" to="/profile/password">Change Password</Link>
      </div>

      {profile.isLoading ? <LoadingPanel /> : null}
      {profile.error ? <ErrorAlert error={profile.error} /> : null}
      {saveMutation.error ? <ErrorAlert error={saveMutation.error} title="Unable to update profile" /> : null}

      {profile.data ? (
        <>
          <section className="panel">
            <dl className="kvGrid">
              <div><dt>Username</dt><dd>{profile.data.username}</dd></div>
              <div><dt>Employee</dt><dd>{profile.data.employee_code || '-'}</dd></div>
              <div><dt>Department</dt><dd>{profile.data.department || '-'}</dd></div>
              <div><dt>Status</dt><dd><span className={`badge ${profile.data.active ? 'active' : 'rejected'}`}>{profile.data.active ? 'ACTIVE' : 'LOCKED'}</span></dd></div>
            </dl>
          </section>

          <section className="panel formStack">
            <h2>Profile Information</h2>
            <div className="formGrid">
              <label className="span2">Full Name<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
              <label className="span2">Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            </div>
            <div className="formActions">
              <button className="primaryButton" type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Roles</h2>
            <div className="chipList">
              {profile.data.roles.map((role) => <span className="badge active" key={role}>{role}</span>)}
            </div>
          </section>

          <section className="panel">
            <h2>Permissions</h2>
            <div className="permissionGrid">
              {profile.data.permissions.map((permission) => <span className="badge" key={permission}>{permission}</span>)}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
