import { runIngestion, isRunning } from './engine.js';
import { scoreJobs } from './scorer.js';

/**
 * Optional automated runs. Set DISCOVERY_CRON in server/.env, e.g.:
 *   DISCOVERY_CRON=0 8 * * *   (every day at 8am)
 * No-op when unset (and on serverless, where this module is never imported).
 */
export async function startScheduler() {
  const expr = process.env.DISCOVERY_CRON;
  if (!expr) return;

  const { default: cron } = await import('node-cron');
  if (!cron.validate(expr)) {
    console.warn(`[scheduler] Invalid DISCOVERY_CRON expression: "${expr}" — scheduler disabled`);
    return;
  }

  cron.schedule(expr, async () => {
    if (isRunning()) return;
    console.log('[scheduler] Starting scheduled discovery run');
    try {
      const summary = await runIngestion({ score: (ids, emit) => scoreJobs(ids, emit) });
      console.log(`[scheduler] Done: ${summary.fetched} fetched, ${summary.inserted} new`);
    } catch (err) {
      console.error(`[scheduler] Run failed: ${err.message}`);
    }
  });
  console.log(`[scheduler] Discovery scheduled: ${expr}`);
}
