require('dotenv').config({ path: '/Users/anshulsaxena/Prysm/server/.env' });
const { query } = require('/Users/anshulsaxena/Prysm/server/src/config/db');

async function counts() {
  console.log('=== DATABASE COUNTS ===\n');
  const tables = ['locations', 'users', 'policies', 'claims', 'worker_wallets', 'disruption_triggers', 'payouts'];
  for (const t of tables) {
    try {
      const { rows } = await query('SELECT COUNT(*) FROM ' + t);
      console.log(t + ': ' + rows[0].count);
    } catch(e) {
      console.log(t + ': ERROR - ' + e.message);
    }
  }

  console.log('\n--- Users by role ---');
  try {
    const { rows } = await query("SELECT role, COUNT(*) FROM users GROUP BY role");
    rows.forEach(r => console.log('  ' + r.role + ': ' + r.count));
  } catch(e) { console.log('  ERROR: ' + e.message); }

  console.log('\n--- Policies by status ---');
  try {
    const { rows } = await query("SELECT status, COUNT(*) FROM policies GROUP BY status");
    if (rows.length === 0) console.log('  (none)');
    rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));
  } catch(e) { console.log('  ERROR: ' + e.message); }

  console.log('\n--- Claims by status ---');
  try {
    const { rows } = await query("SELECT status, COUNT(*) FROM claims GROUP BY status");
    if (rows.length === 0) console.log('  (none)');
    rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));
  } catch(e) { console.log('  ERROR: ' + e.message); }

  console.log('\n--- Disruption triggers by status ---');
  try {
    const { rows } = await query("SELECT status, COUNT(*) FROM disruption_triggers GROUP BY status");
    if (rows.length === 0) console.log('  (none)');
    rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));
  } catch(e) { console.log('  ERROR: ' + e.message); }

  console.log('\n--- Sample workers ---');
  try {
    const { rows } = await query("SELECT id, name, phone, platform, role FROM users ORDER BY id LIMIT 10");
    rows.forEach(r => console.log('  [' + r.id + '] ' + r.name + ' | ' + r.phone + ' | ' + r.platform + ' | ' + r.role));
  } catch(e) { console.log('  ERROR: ' + e.message); }

  process.exit(0);
}
counts().catch(e => { console.error(e); process.exit(1); });
