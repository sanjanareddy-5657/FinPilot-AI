import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(fullName);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div className="animate-fade-in-up" style={{ opacity: 0, marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Account Settings</h2>
        <p style={{ color: 'var(--text-muted)' }}>Manage your personal details and security credentials.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Profile Card & Info */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel animate-fade-in-up delay-100" style={{ opacity: 0 }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={20} color="var(--primary)" /> Profile Info
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Full Name</div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>{user?.full_name}</div>
              </div>
              
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Email Address</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} color="var(--text-muted)" /> {user?.email}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Member Since</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} color="var(--text-muted)" /> {formatDate(user?.created_at)}
                </div>
              </div>
            </div>
          </div>

          {/* Update Profile Form */}
          <div className="glass-panel animate-fade-in-up delay-200" style={{ opacity: 0 }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update details</h3>
            
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--surface-border)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isUpdatingProfile}>
                {isUpdatingProfile ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderLeftColor: 'white' }} />
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Form */}
        <div style={{ flex: '1.5 1 450px' }}>
          <div className="glass-panel animate-fade-in-up delay-200" style={{ opacity: 0, height: '100%' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} color="var(--primary)" /> Change Password
            </h3>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--surface-border)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>New Password</label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--surface-border)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => confirmPassword !== undefined && setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--surface-border)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderLeftColor: 'white' }} />
                    Updating Password...
                  </>
                ) : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
