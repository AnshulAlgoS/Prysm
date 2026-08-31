// ============================================================================
// Prysm — Worker Claims History
// ============================================================================

import { useState, useCallback } from 'react';
import { claimAPI } from '../../api';
import { usePolling } from '../../hooks/usePolling';
import { FiClock, FiCheckCircle, FiXCircle, FiEye, FiAlertTriangle } from 'react-icons/fi';

export default function Claims() {
  const [selected, setSelected] = useState(null);

  const fetchClaims = useCallback(async () => {
    try {
      const { data } = await claimAPI.list({});
      return data.data?.claims || [];
    } catch {
      return [];
    }
  }, []);

  const { data: claimsObj, loading } = usePolling(fetchClaims, 3000);
  const claims = claimsObj || [];

  const statusIcon = (s) => {
    if (s === 'auto_approved' || s === 'approved') return <FiCheckCircle color="#10b981" />;
    if (s === 'blocked' || s === 'rejected') return <FiXCircle color="#ef4444" />;
    if (s === 'under_review') return <FiEye color="#f59e0b" />;
    return <FiClock color="#06b6d4" />;
  };

  const statusBadge = (s) => {
    const map = { auto_approved: 'success', approved: 'success', blocked: 'danger', rejected: 'danger', under_review: 'warning', pending: 'info' };
    return <span className={`prysm-badge prysm-badge-${map[s] || 'accent'}`}>{statusIcon(s)} {s?.replace('_', ' ')}</span>;
  };

  return (
    <div className="prysm-page prysm-fade-in">
      <h1 className="prysm-page-title">Claim History</h1>
      <p className="prysm-page-subtitle">Track auto-triggered insurance claims and payouts</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Claims', value: claims.length, color: 'var(--prysm-accent-light)' },
          { label: 'Approved', value: claims.filter(c => c.status === 'auto_approved' || c.status === 'approved').length, color: 'var(--prysm-success)' },
          { label: 'Pending', value: claims.filter(c => c.status === 'pending' || c.status === 'under_review').length, color: 'var(--prysm-warning)' },
          { label: 'Total Received', value: '₹' + claims.filter(c => c.status === 'auto_approved' || c.status === 'approved').reduce((s, c) => s + parseFloat(c.claim_amount || 0), 0).toLocaleString(), color: 'var(--prysm-success)' },
        ].map((s, i) => (
          <div key={i} className="prysm-stat">
            <div className="prysm-stat-value" style={{ fontSize: '1.5rem', background: 'none', WebkitTextFillColor: s.color, color: s.color }}>{s.value}</div>
            <div className="prysm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Claims table */}
      {claims.length > 0 ? (
        <div className="prysm-card">
          <table className="prysm-table">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Fraud Score</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.claim_number}</td>
                  <td>{c.disruption_type?.replace('_', ' ')}</td>
                  <td style={{ fontWeight: 600 }}>₹{c.claim_amount}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--prysm-border)' }}>
                        <div style={{ width: `${(c.fraud_score || 0) * 100}%`, height: '100%', borderRadius: 3, background: (c.fraud_score || 0) > 0.8 ? '#ef4444' : (c.fraud_score || 0) > 0.3 ? '#f59e0b' : '#10b981' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--prysm-text-muted)' }}>{((c.fraud_score || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td>
                    <button className="prysm-btn prysm-btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <FiEye size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="prysm-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FiClock size={48} color="var(--prysm-text-muted)" />
          <p style={{ color: 'var(--prysm-text-muted)', marginTop: '1rem' }}>No claims yet. Claims are auto-triggered when disruptions occur.</p>
        </div>
      )}

      {/* Claim detail modal - Zero Touch Timeline */}
      {selected && (
        <div className="prysm-card prysm-fade-in" style={{ marginTop: '1.5rem', border: '1px solid var(--prysm-accent)', background: 'rgba(99,102,241,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--prysm-border)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 600, color: 'var(--prysm-text)' }}>Zero-Touch Claim Timeline</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--prysm-text-secondary)' }}>Claim #: {selected.claim_number}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--prysm-text-muted)', cursor: 'pointer' }}><FiXCircle size={22} /></button>
          </div>

          <div style={{ display: 'flex', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '2rem', alignItems: 'center' }}>
            <div style={{ marginRight: '1rem', background: '#10b981', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiCheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#10b981', fontSize: '1.1rem' }}>🎉 You are eligible for ₹{selected.claim_amount} compensation!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--prysm-text-secondary)', marginTop: '2px' }}>Your claim for {selected.disruption_type?.replace('_', ' ')} has been auto-processed.</div>
            </div>
          </div>

          <div style={{ position: 'relative', paddingLeft: '2rem', marginBottom: '2rem' }}>
            {/* Vertical Line */}
            <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: 'var(--prysm-accent-light)' }}></div>
            
            {/* Step 1: Detected */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <div style={{ position: 'absolute', left: '-2.15rem', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--prysm-accent)' }}></div>
              <div style={{ fontWeight: 600, color: 'var(--prysm-text)' }}>1. Event Detected & Logged</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--prysm-text-secondary)' }}>{new Date(selected.created_at).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid var(--prysm-border)', marginTop: '6px' }}>
                <span style={{ color: 'var(--prysm-accent)', fontWeight: 600 }}>[Trigger Activated]</span> {selected.disruption_type?.replace('_', ' ').toUpperCase()} threshold crossed. Claim auto-created.
              </div>
            </div>

            {/* Step 2: Verified */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <div style={{ position: 'absolute', left: '-2.15rem', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--prysm-accent)' }}></div>
              <div style={{ fontWeight: 600, color: 'var(--prysm-text)' }}>2. AI Verification & Fraud Check</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--prysm-text-secondary)' }}>{new Date(selected.created_at).toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid var(--prysm-border)', marginTop: '6px' }}>
                <span style={{ color: (selected.fraud_score || 0) > 0.3 ? 'var(--prysm-warning)' : 'var(--prysm-success)', fontWeight: 600 }}>[AI Validation]</span> Risk Score: {((selected.fraud_score || 0) * 100).toFixed(1)}%. {
                  (selected.fraud_score || 0) > 0.3 ? "Flagged for review due to risk factors." : "Clean verification, Location matches + normal pattern."
                }
              </div>
            </div>

            {/* Step 3: Paid */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-2.15rem', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: (selected.status === 'auto_approved' || selected.status === 'approved') ? 'var(--prysm-success)' : 'var(--prysm-border)' }}></div>
              <div style={{ fontWeight: 600, color: 'var(--prysm-text)' }}>3. Instant Payout</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--prysm-text-secondary)' }}>Status: {statusBadge(selected.status)}</div>
              {(selected.status === 'auto_approved' || selected.status === 'approved') && (
                <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', border: '1px solid var(--prysm-border)', marginTop: '6px' }}>
                  <span style={{ color: 'var(--prysm-success)', fontWeight: 600 }}>[Razorpay Triggered]</span> ₹{selected.claim_amount} sent to linked UPI immediately.
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
