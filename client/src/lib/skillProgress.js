/**
 * Derive a 0–100 progression and tier hints for game-style skill UI.
 * Uses status as the spine; blends in numeric level pairs when parseable.
 */

const STATUS_BASE = {
  not_started: 8,
  paused: 22,
  in_progress: 48,
  completed: 100,
};

function parseLevelPair(currentLevel, targetLevel) {
  const curStr = String(currentLevel || '').trim();
  const tgtStr = String(targetLevel || '').trim();
  const frac = curStr.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (b > 0) return { cur: a, target: b, mode: 'fraction' };
  }
  const nCur = Number(curStr.replace(/[^\d.-]/g, ''));
  const nTgt = Number(tgtStr.replace(/[^\d.-]/g, ''));
  if (Number.isFinite(nCur) && Number.isFinite(nTgt) && nTgt > 0) {
    return { cur: nCur, target: nTgt, mode: 'numeric' };
  }
  if (Number.isFinite(nCur) && nCur >= 0 && nCur <= 10 && !Number.isFinite(nTgt)) {
    return { cur: nCur, target: 10, mode: 'guess' };
  }
  return null;
}

/**
 * @param {object} skill
 * @returns {{ percent: number, status: string, stageIndex: number, stages: string[] }}
 */
export function getSkillProgress(skill) {
  const status = skill?.status || 'not_started';
  let percent = STATUS_BASE[status] ?? 15;

  const pair = parseLevelPair(skill?.current_level, skill?.target_level);
  if (pair && status !== 'completed') {
    const ratio = Math.min(1, Math.max(0, pair.cur / pair.target));
    percent = Math.round(Math.max(percent, 18 + ratio * 72));
  }

  if (status === 'completed') percent = 100;

  const stages = ['LOCK', 'PAUSE', 'RUN', 'CLEAR'];
  const stageIndex =
    status === 'not_started' ? 0 : status === 'paused' ? 1 : status === 'in_progress' ? 2 : status === 'completed' ? 3 : 0;

  return {
    percent: Math.min(100, Math.max(0, percent)),
    status,
    stageIndex,
    stages,
  };
}
