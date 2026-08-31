// ============================================================================
// Prysm — Register Page
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiShield, FiUser, FiPhone, FiLock, FiTruck, FiArrowRight } from 'react-icons/fi';

const PLATFORMS = [
  { value: 'zomato',  label: '🍕 Zomato' },
  { value: 'swiggy',  label: '🍔 Swiggy' },
  { value: 'amazon',  label: '📦 Amazon' },
  { value: 'zepto',   label: '⚡ Zepto' },
  { value: 'blinkit', label: '🛒 Blinkit' },
  { value: 'other',   label: '🚀 Other' },
];

export default function Register() {
  const [form, setForm] = useState({ name: '', phone: '', password: '', platform: 'zomato' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prysm-auth-wrapper">
      <div className="prysm-auth-card prysm-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'rgba(16,185,129,0.15)', marginBottom: '1rem' }}>
            <FiShield size={28} color="#10b981" />
          </div>
          <h1>Get Protected</h1>
          <p style={{ color: 'var(--prysm-text-secondary)', fontSize: '0.9rem' }}>
            Join Prysm — insurance built for delivery workers
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--prysm-danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--prysm-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="prysm-label"><FiUser size={12} /> Full Name</label>
            <input name="name" className="prysm-input" placeholder="Enter your full name" value={form.name} onChange={handleChange} required />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="prysm-label"><FiPhone size={12} /> Phone Number</label>
            <input name="phone" type="tel" className="prysm-input" placeholder="10-digit phone number" value={form.phone} onChange={handleChange} required />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="prysm-label"><FiLock size={12} /> Password</label>
            <input name="password" type="password" className="prysm-input" placeholder="Create a password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="prysm-label"><FiTruck size={12} /> Delivery Platform</label>
            <select name="platform" className="prysm-input" value={form.platform} onChange={handleChange}>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <button type="submit" className="prysm-btn prysm-btn-success" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? 'Creating account...' : <>Create Account <FiArrowRight /></>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--prysm-text-secondary)' }}>
          Already registered? <Link to="/login" style={{ color: 'var(--prysm-accent-light)', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
