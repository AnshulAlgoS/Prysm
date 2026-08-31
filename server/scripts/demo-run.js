// ============================================================================
// Prysm — Full End-to-End Demo Runner
// ============================================================================
// Runs the complete lifecycle in sequence:
//   1. Register a worker
//   2. Worker buys a weekly policy
//   3. Admin triggers a simulated disruption
//   4. System detects and creates claim
//   5. Fraud detection runs
//   6. Payout processed to worker wallet
//
// Usage: node scripts/demo-run.js
// ============================================================================

require('dotenv').config();
const { query, testConnection } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const { generatePolicyNumber, getPayoutAmount } = require('../src/utils/helpers');
const logger = require('../src/utils/logger');

const DELAY = (ms) => new Promise(r => setTimeout(r, ms));

function pad(n) { return String(n).padStart(2, '0'); }
function toYMD(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekStart: toYMD(monday), weekEnd: toYMD(sunday) };
}

let evaluateAllTriggers, ClaimProcessor, RazorpayService;
try { evaluateAllTriggers = require('../src/services/trigger-engine/triggers').evaluateAllTriggers; } catch(e) { evaluateAllTriggers = null; }
try { ClaimProcessor = require('../src/services/trigger-engine/processor'); } catch(e) { ClaimProcessor = null; }
try { RazorpayService = require('../src/services/razorpay.service'); } catch(e) { RazorpayService = null; }

async function mockRazorpayOrder(amount, receipt) {
  return { id: `order_mock_${Date.now()}`, entity: 'order', amount: amount*100, receipt, status: 'created' };
}
async function mockRazorpayCapture(order) {
  return { id: order.id, status: 'captured', amount: order.amount };
}

async function runDemo() {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║  🎬 Prysm — Full End-to-End Demo                        ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');
  logger.info('');

  const ok = await testConnection();
  if (!ok) { logger.error('DB failed.'); process.exit(1); }

  const { weekStart, weekEnd } = getWeekRange();
  logger.info(`   📅 Policy week: ${weekStart} → ${weekEnd}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Worker Registration
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 1: 👷 Worker Registration');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  const phone = `98765${String(Date.now()).slice(-5)}`;
  const pass = await bcrypt.hash('demo123', 10);

  // Ensure a zone exists
  let { rows: zones } = await query(`SELECT * FROM locations WHERE is_active = TRUE LIMIT 1`);
  if (!zones.length) {
    await query(
      `INSERT INTO locations (zone_name, city, state, latitude, longitude, risk_score, flood_risk, is_active)
       VALUES ('Andheri West', 'Mumbai', 'Maharashtra', 19.1364, 72.8296, 0.75, 0.8, TRUE)`
    );
    ({ rows: zones } = await query(`SELECT * FROM locations WHERE is_active = TRUE LIMIT 1`));
  }
  const zone = zones[0];

  const { rows: [worker] } = await query(
    `INSERT INTO users (name, phone, password_hash, role, platform, zone_id, upi_id, kyc_status, is_active)
     VALUES ($1, $2, $3, 'worker', 'zomato', $4, $5, 'verified', TRUE)
     RETURNING *`,
    ['Demo Worker', phone, pass, zone.id, `${phone}@upi`]
  );

  logger.info(`   ✅ Worker registered: ${worker.name}`);
  logger.info(`      Phone: ${phone}`);
  logger.info(`      Platform: Zomato`);
  logger.info(`      Zone: ${zone.zone_name} (${zone.city})`);
  logger.info(`      UPI: ${phone}@upi`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Buy Weekly Policy
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 2: 📋 Worker Buys Weekly Policy');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  const tier = 'standard';
  const premium = 60;
  const payout = getPayoutAmount(tier);
  const policyNumber = generatePolicyNumber();

  const { rows: [policy] } = await query(
    `INSERT INTO policies
      (policy_number, worker_id, zone_id, disruption_type, coverage_tier,
       premium_amount, payout_amount, max_claims_per_week, week_start, week_end, status, activated_at, auto_renew, pricing_factors)
     VALUES ($1, $2, $3, 'extreme_rain', $4, $5, $6, 2, $7, $8, 'active', NOW(), TRUE, $9)
     RETURNING *`,
    [policyNumber, worker.id, zone.id, tier, premium, payout, weekStart, weekEnd, JSON.stringify({ demo: true })]
  );

  let order, capture;
  try {
    if (RazorpayService && process.env.RAZORPAY_KEY_ID && false) {
      order = await RazorpayService.createOrder({ amount: premium, receipt: policyNumber });
      capture = await RazorpayService.capturePayment({ paymentId: order.id, amount: premium });
    } else {
      order = await mockRazorpayOrder(premium, policyNumber);
      capture = await mockRazorpayCapture(order);
    }
  } catch(e) {
    const msg = e?.message || e?.error?.description || String(e);
    logger.warn(`   ⚠️  Razorpay unavailable, using mock: ${msg.split('\n')[0]}`);
    order = await mockRazorpayOrder(premium, policyNumber);
    capture = await mockRazorpayCapture(order);
  }

  // Create wallet
  await query(
    `INSERT INTO worker_wallets (worker_id, balance, total_credited, total_debited)
     VALUES ($1, 0, 0, $2) ON CONFLICT (worker_id) DO UPDATE SET total_debited = worker_wallets.total_debited + $2`,
    [worker.id, premium]
  );

  logger.info(`   ✅ Policy purchased: ${policyNumber}`);
  logger.info(`      Coverage: ${tier} (extreme_rain)`);
  logger.info(`      Premium paid: ₹${premium}`);
  logger.info(`      Payout if triggered: ₹${payout}`);
  logger.info(`      Valid: ${weekStart} → ${weekEnd}`);
  logger.info(`      Razorpay Order: ${order.id}`);
  logger.info(`      Payment: ${capture.status === 'captured' ? '✅ Captured' : '❌ Failed'}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Admin Triggers Simulated Heavy Rain
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 3: 🌧️ Admin Triggers Simulated Heavy Rain');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  const envData = {
    weather: {
      temperature: 24, feels_like: 26, humidity: 98,
      rainfall_1h: 40, rainfall_3h: 95, wind_speed: 45,
      description: 'heavy intensity rain',
    },
    rainfall_forecast: { total_rainfall_mm: 130, risk_level: 'high' },
    aqi: null, traffic: null, alerts: null,
  };

  logger.info(`   🌧️ Injecting rainfall: 95mm/3h (threshold: 70mm)`);
  logger.info(`   🌧️ Forecast: 130mm in 24h`);
  logger.info(`   📍 Target zone: ${zone.zone_name} (${zone.city})`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: System Detects Disruption Automatically
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 4: ⚡ System Detects Disruption');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  const triggers = evaluateAllTriggers(envData);
  logger.info(`   ⚡ Triggers detected: ${triggers.length}`);
  for (const t of triggers) {
    logger.info(`      → ${t.disruption_type} | severity: ${t.severity} | confidence: ${(t.confidence * 100).toFixed(1)}% | measured: ${t.measured_value}mm (threshold: ${t.threshold_value}mm)`);
  }

  if (triggers.length === 0) {
    logger.warn('   ⊘ No triggers fired. Demo incomplete.');
    process.exit(0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Claim Created + Fraud Detection
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 5: 🔍 Claim Created + Fraud Detection');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  const result = await ClaimProcessor.process(triggers[0], zone, envData);

  logger.info(`   📝 Claims created: ${result.claims_created}`);
  logger.info(`   ✅ Auto-approved: ${result.claims_auto_approved}`);
  logger.info(`   🔍 Flagged for review: ${result.claims_flagged}`);
  logger.info(`   ⏭️ Skipped (limit): ${result.claims_skipped}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: Payment Triggered
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  STEP 6: 💸 Payout Processed');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await DELAY(500);

  if (result.payouts_initiated > 0) {
    // Get the wallet
    const { rows: [wallet] } = await query(
      `SELECT * FROM worker_wallets WHERE worker_id = $1`, [worker.id]
    );

    logger.info(`   💰 Payout amount: ₹${result.total_payout_amount}`);
    logger.info(`   💳 Razorpay payout: Processed via UPI`);
    logger.info(`   👛 Wallet balance: ₹${wallet?.balance || result.total_payout_amount}`);
    logger.info(`   📲 UPI: ${phone}@upi`);
  } else {
    logger.info(`   ⊘ No payouts (claims may have been flagged for review)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║  🎬 DEMO COMPLETE                                        ║');
  logger.info('╠══════════════════════════════════════════════════════════╣');
  logger.info(`║  Worker:     ${worker.name} (${phone})`);
  logger.info(`║  Zone:       ${zone.zone_name}, ${zone.city}`);
  logger.info(`║  Policy:     ${policyNumber} (${tier})`);
  logger.info(`║  Disruption: extreme_rain (95mm/3h)`);
  logger.info(`║  Triggers:   ${triggers.length} detected`);
  logger.info(`║  Claims:     ${result.claims_created} created`);
  logger.info(`║  Approved:   ${result.claims_auto_approved}`);
  logger.info(`║  Payout:     ₹${result.total_payout_amount}`);
  logger.info('╚══════════════════════════════════════════════════════════╝');

  process.exit(0);
}

runDemo().catch(err => { console.error(err); process.exit(1); });
