require('dotenv').config();
const { query } = require('../src/config/db');
const { generatePolicyNumber, generateClaimNumber, generateTransactionRef, getPayoutAmount } = require('../src/utils/helpers');
const logger = require('../src/utils/logger');

function pad(n) { return String(n).padStart(2, '0'); }
function toYMD(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(now.getDate() + diff);
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekStart: toYMD(monday), weekEnd: toYMD(sunday) };
}

function getLastWeekRange() {
  const { weekStart, weekEnd } = getCurrentWeekRange();
  const ws = new Date(weekStart); ws.setDate(ws.getDate() - 7);
  const we = new Date(weekEnd); we.setDate(we.getDate() - 7);
  return { weekStart: toYMD(ws), weekEnd: toYMD(we) };
}

async function seed() {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════╗');
  logger.info('║  📋 Policies + Claims Seed                          ║');
  logger.info('╚══════════════════════════════════════════════════════╝');

  const curWk = getCurrentWeekRange();
  const lastWk = getLastWeekRange();
  const weekStart = curWk.weekStart;
  const weekEnd = curWk.weekEnd;
  const lastWeek = lastWk;
  logger.info(`   📅 Current week: ${weekStart} -> ${weekEnd}`);
  logger.info(`   📅 Last week:    ${lastWeek.weekStart} -> ${lastWeek.weekEnd}`);

  const tiers = ['basic', 'standard', 'premium'];
  const disruptionTypes = ['extreme_rain', 'extreme_heat', 'air_pollution', 'flood'];

  // ── 1. Get all workers ──
  const { rows: workers } = await query("SELECT id, name, phone, zone_id, platform FROM users WHERE role = 'worker'");
  logger.info(`👷 Found ${workers.length} workers`);

  // ── 2. Get zones ──
  const { rows: zones } = await query("SELECT id, zone_name, city, risk_score FROM locations");
  logger.info(`📍 Found ${zones.length} zones`);

  // ── 3. Create wallets for each worker ──
  let walletsCreated = 0;
  for (const w of workers) {
    try {
      await query(
        `INSERT INTO worker_wallets (worker_id, balance, total_credited, total_debited)
         VALUES ($1, 0, 0, 0) ON CONFLICT (worker_id) DO NOTHING`,
        [w.id]
      );
      walletsCreated++;
    } catch (e) { /* ignore */ }
  }
  logger.info(`👛 Wallets: ${walletsCreated} created/verified`);

  // ── 4. Get or create disruption triggers ──
  const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const adminId = adminRes.rows[0]?.id;

  let triggerIds = [];
  const { rows: existingTriggers } = await query("SELECT id FROM disruption_triggers WHERE status IN ('confirmed','detected')");
  triggerIds = existingTriggers.map(t => t.id);

  if (triggerIds.length < 4) {
    const needed = 4 - triggerIds.length;
    for (let i = 0; i < needed; i++) {
      const zone = zones[i % zones.length];
      const dtype = disruptionTypes[i % disruptionTypes.length];
      const thresholds = { extreme_rain: 70, extreme_heat: 45, air_pollution: 300, flood: 50 };
      const measured = thresholds[dtype] + (i + 1) * 10;
      const { rows } = await query(
        `INSERT INTO disruption_triggers
           (zone_id, disruption_type, measured_value, threshold_value, ml_confidence, status, severity, confirmed_by, triggered_at, source_data)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, NOW() - ($8 || '0 hours')::INTERVAL, $9)
         RETURNING id`,
        [
          zone.id,
          dtype,
          measured,
          thresholds[dtype],
          0.85 + (i % 3) * 0.05,
          ['moderate', 'severe', 'extreme', 'moderate'][i],
          adminId,
          i * 6,
          JSON.stringify({ weather_station: `WS-${100+i}`, rainfall_sources: 3 })
        ]
      );
      triggerIds.push(rows[0].id);
    }
  }
  logger.info(`⚡ Triggers: ${triggerIds.length} available`);

  // ── 5. Create policies (2 per worker: 1 active, 1 expired) ──
  const policiesCreated = [];
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const tier = tiers[i % tiers.length];
    const payout = getPayoutAmount(tier);
    const premium = tier === 'basic' ? 30 : tier === 'standard' ? 60 : 120;
    const dtype = disruptionTypes[i % disruptionTypes.length];
    const zoneForPolicy = w.zone_id || zones[i % zones.length].id;

    // Active policy for current week
    const pn1 = generatePolicyNumber();
    try {
      const result = await query(
        `INSERT INTO policies
           (policy_number, worker_id, zone_id, disruption_type, coverage_tier,
            premium_amount, payout_amount, max_claims_per_week, week_start, week_end,
            status, auto_renew, activated_at, pricing_factors)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 2, $8, $9, 'active', TRUE, NOW() - INTERVAL '2 days', $10)
         RETURNING *`,
        [pn1, w.id, zoneForPolicy, dtype, tier, premium, payout, weekStart, weekEnd,
         JSON.stringify({ zone_risk: 0.65, season: 'monsoon', model_version: 'v1.2' })]
      );
      policiesCreated.push(result.rows[0]);
    } catch (e) {
      logger.warn(`   ! Skipping active policy dup: ${e.message.split('\n')[0]}`);
    }

    // Expired policy from last week
    const pn2 = generatePolicyNumber();
    try {
      const lastTier = tiers[(i + 1) % tiers.length];
      const lastPayout = getPayoutAmount(lastTier);
      const lastPremium = lastTier === 'basic' ? 30 : lastTier === 'standard' ? 60 : 120;
      await query(
        `INSERT INTO policies
           (policy_number, worker_id, zone_id, disruption_type, coverage_tier,
            premium_amount, payout_amount, max_claims_per_week, week_start, week_end,
            status, activated_at, cancelled_at, pricing_factors)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 2, $8, $9, 'expired', NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days', $10)
         RETURNING id`,
        [pn2, w.id, zoneForPolicy, dtype, lastTier, lastPremium, lastPayout,
         lastWeek.weekStart, lastWeek.weekEnd,
         JSON.stringify({ zone_risk: 0.55, season: 'summer', model_version: 'v1.1' })]
      );
      policiesCreated.push({ id: 'expired-' + i, policy_number: pn2 });
    } catch (e) {
      logger.warn(`   ! Skipping expired policy dup: ${e.message.split('\n')[0]}`);
    }
  }
  const activeCount = policiesCreated.filter(p => !p.id?.startsWith('expired')).length;
  const expiredCount = policiesCreated.length - activeCount;
  logger.info(`📋 Policies: ${activeCount} active + ${expiredCount} expired = ${policiesCreated.length} total`);

  // ── 6. Create claims (use active policies only) ──
  const { rows: activePolicies } = await query(
    `SELECT p.*, u.name as worker_name, u.phone as worker_phone
     FROM policies p JOIN users u ON p.worker_id = u.id
     WHERE p.status = 'active'`
  );
  logger.info(`   → Using ${activePolicies.length} active policies for claims`);

  const claimStatuses = ['auto_approved', 'under_review', 'approved', 'rejected'];
  const claimsCreated = [];
  let payoutsTotal = 0;
  let payoutsCount = 0;

  for (let i = 0; i < activePolicies.length; i++) {
    const pol = activePolicies[i];
    const statusCycle = claimStatuses[i % claimStatuses.length];
    const triggerId = triggerIds[i % triggerIds.length];
    const cn = generateClaimNumber();
    const fraudScore = statusCycle === 'rejected' ? 0.87 : statusCycle === 'under_review' ? 0.52 : 0.12;

    const fraudFlags = statusCycle === 'rejected'
      ? [{ flag_type: 'location_mismatch', confidence: 0.91, details: 'Worker GPS 35km outside zone' }]
      : statusCycle === 'under_review'
      ? [{ flag_type: 'historical_anomaly', confidence: 0.62, details: 'Above average claim frequency' }]
      : [];

    const needsReview = ['auto_approved', 'approved', 'rejected'].includes(statusCycle);
    const reviewedByVal = needsReview ? (statusCycle === 'under_review' ? null : adminId) : null;
    const reviewedAtVal = needsReview ? new Date() : null;
    try {
      const result = await query(
        `INSERT INTO claims
           (claim_number, policy_id, worker_id, trigger_id, zone_id, disruption_type,
            claim_amount, fraud_score, status, auto_triggered, fraud_flags, evidence,
            reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::claim_status_type, TRUE, $10, $11, $12, $13)
         RETURNING *`,
        [
          cn, pol.id, pol.worker_id, triggerId, pol.zone_id, pol.disruption_type,
          pol.payout_amount, fraudScore, statusCycle,
          JSON.stringify(fraudFlags),
          JSON.stringify({
            weather: { rainfall_3h: 95 + i * 3, humidity: 96 },
            gps_accuracy: 8 + (i % 5),
            zone_confirmed: true,
            policy_snapshot: { tier: pol.coverage_tier, week: `${pol.week_start}/${pol.week_end}` }
          }),
          reviewedByVal,
          reviewedAtVal
        ]
      );
      claimsCreated.push(result.rows[0]);

      // For auto_approved/approved claims: create payout + wallet tx + update wallet
      if (statusCycle === 'auto_approved' || statusCycle === 'approved') {
        const payoutAmt = parseFloat(pol.payout_amount);
        const txnRef = generateTransactionRef();

        // Create payout record
        try {
          await query(
            `INSERT INTO payouts (claim_id, worker_id, amount, status, razorpay_payout_id, upi_transaction_id, disbursed_at)
             VALUES ($1, $2, $3, 'processed', $4, $5, NOW())`,
            [result.rows[0].id, pol.worker_id, payoutAmt, `payout_${txnRef}`, `UPI${txnRef}`]
          );
        } catch (e) { /* ignore */ }

        // Update claim with tx ref
        try {
          await query(`UPDATE claims SET payout_transaction_ref = $1 WHERE id = $2`, [txnRef, result.rows[0].id]);
        } catch (e) { /* ignore col missing */ }

        // Update wallet
        await query(
          `INSERT INTO worker_wallets (worker_id, balance, total_credited, total_debited)
           VALUES ($1, $2, $2, 0)
           ON CONFLICT (worker_id) DO UPDATE
             SET balance = worker_wallets.balance + $2,
                 total_credited = worker_wallets.total_credited + $2`,
          [pol.worker_id, payoutAmt]
        );

        // Wallet transaction
        try {
          await query(
            `INSERT INTO wallet_transactions (worker_id, amount, type, balance_after, description)
             VALUES ($1, $2, 'payout', (SELECT balance FROM worker_wallets WHERE worker_id = $1), $3)`,
            [pol.worker_id, payoutAmt, `Claim payout: ${cn}`]
          );
        } catch (e) { /* ignore */ }

        // Debit wallet premium for active policies
        const premium = parseFloat(pol.premium_amount);
        await query(
          `UPDATE worker_wallets
           SET balance = balance - $2, total_debited = total_debited + $2
           WHERE worker_id = $1 AND balance >= $2`,
          [pol.worker_id, premium]
        );

        payoutsTotal += payoutAmt;
        payoutsCount++;
      }

      // Also debit premium from all workers with active policies
      const premium = parseFloat(pol.premium_amount);
      try {
        await query(
          `UPDATE worker_wallets
           SET total_debited = total_debited + $2
           WHERE worker_id = $1`,
          [pol.worker_id, premium]
        );
      } catch (e) { /* ignore */ }
    } catch (e) {
      logger.warn(`   ! Claim for ${pol.worker_name}: ${e.message.split('\n')[0]}`);
    }
  }

  const byStatus = {};
  claimsCreated.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

  logger.info(`📝 Claims: ${claimsCreated.length} total`);
  Object.keys(byStatus).forEach(s => logger.info(`   → ${s}: ${byStatus[s]}`));
  logger.info(`💸 Payouts: ${payoutsCount} processed, total ₹${payoutsTotal.toFixed(2)}`);

  // ── 7. Summary ──
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════╗');
  logger.info('║  ✅ Policies + Claims seeding DONE!                 ║');
  logger.info('╠══════════════════════════════════════════════════════╣');
  logger.info(`║  Workers:         ${String(workers.length).padEnd(4)}                       ║`);
  logger.info(`║  Wallets:         ${String(walletsCreated).padEnd(4)}                       ║`);
  logger.info(`║  Policies total:  ${String(policiesCreated.length).padEnd(4)} (${activeCount} active, ${expiredCount} expired) ║`);
  logger.info(`║  Claims total:    ${String(claimsCreated.length).padEnd(4)}                       ║`);
  logger.info(`║  Payouts:         ${payoutsCount} (₹${payoutsTotal.toFixed(2)})              ║`);
  logger.info('╚══════════════════════════════════════════════════════╝');

  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
