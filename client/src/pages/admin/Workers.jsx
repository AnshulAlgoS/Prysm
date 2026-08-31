// ============================================================================
// Prysm — Admin Workers Page
// ============================================================================

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { FiUsers, FiSearch } from 'react-icons/fi';

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await adminAPI.workers({});
        setWorkers(data.data?.workers || []);
      } catch (err) { /* graceful */ }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = workers.filter(w =>
    (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.phone || '').includes(search)
  );

  return (
    <div className="prysm-page prysm-fade-in">
      <h1 className="prysm-page-title">Workers</h1>
      <p className="prysm-page-subtitle">Registered delivery workers on the platform</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 400 }}>
        <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--prysm-text-muted)' }} />
        <input className="prysm-input" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
      </div>

      <div className="prysm-card">
        <table className="prysm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Platform</th>
              <th>Role</th>
              <th>Zone</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 500 }}>{w.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{w.phone}</td>
                <td><span className="prysm-badge prysm-badge-accent">{w.platform || '—'}</span></td>
                <td><span className={`prysm-badge prysm-badge-${w.role === 'admin' ? 'warning' : 'info'}`}>{w.role}</span></td>
                <td style={{ fontSize: '0.85rem' }}>{w.zone_name || '—'}</td>
                <td style={{ fontSize: '0.8rem' }}>{new Date(w.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--prysm-text-muted)' }}>No workers found</div>}
      </div>
    </div>
  );
}
