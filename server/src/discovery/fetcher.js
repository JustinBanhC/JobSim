import robotsParser from 'robots-parser';

const USER_AGENT = 'JobSimDiscovery/1.0 (personal job search tool; contact: local user)';
const MIN_GAP_MS = 2000;
const MAX_RETRIES = 3;

// Per-domain promise queues so concurrent sources never hammer one host.
const domainQueues = new Map();
const robotsCache = new Map();

function getQueue(origin) {
  if (!domainQueues.has(origin)) {
    domainQueues.set(origin, { chain: Promise.resolve(), lastAt: 0 });
  }
  return domainQueues.get(origin);
}

async function fetchRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let robots = null;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      robots = robotsParser(`${origin}/robots.txt`, await res.text());
    }
  } catch {
    // Unreachable robots.txt — treat as no restrictions, per convention.
  }
  robotsCache.set(origin, robots);
  return robots;
}

export async function checkRobots(url) {
  const { origin } = new URL(url);
  const robots = await fetchRobots(origin);
  if (robots && robots.isDisallowed(url, USER_AGENT)) {
    throw new Error(`robots.txt disallows fetching ${url}`);
  }
}

/**
 * Rate-limited, robots-respecting fetch. All adapter HTTP goes through here.
 */
export async function politeFetch(url, options = {}) {
  const { skipRobots = false, ...fetchOptions } = options;
  if (!skipRobots) await checkRobots(url);

  const { origin } = new URL(url);
  const queue = getQueue(origin);

  const task = queue.chain.then(async () => {
    const wait = queue.lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      queue.lastAt = Date.now();
      try {
        const res = await fetch(url, {
          ...fetchOptions,
          headers: { 'User-Agent': USER_AGENT, ...fetchOptions.headers },
          signal: AbortSignal.timeout(30000),
        });
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status} from ${url}`);
        } else {
          return res;
        }
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
    }
    throw lastError;
  });

  // Keep the chain alive even if this task fails.
  queue.chain = task.catch(() => {});
  return task;
}

export { USER_AGENT };
