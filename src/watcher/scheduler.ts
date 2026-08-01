import { runCheckCycle } from './checker';

/**
 * Default interval: 24 hours.
 * Override with WATCHER_INTERVAL_MS env var for demo/testing
 * (e.g. WATCHER_INTERVAL_MS=60000 to run every minute).
 */
const WATCHER_INTERVAL_MS =
  process.env.WATCHER_INTERVAL_MS != null
    ? parseInt(process.env.WATCHER_INTERVAL_MS, 10)
    : 24 * 60 * 60 * 1000;

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startWatcher(): void {
  if (_intervalHandle) return; // already running

  // Run immediately on startup so the first baseline snapshot is captured
  // without waiting 24 hours.
  void runCheckCycle().catch((err: unknown) => {
    console.error('[watcher] initial check failed:', err);
  });

  _intervalHandle = setInterval(() => {
    void runCheckCycle().catch((err: unknown) => {
      console.error('[watcher] scheduled check failed:', err);
    });
  }, WATCHER_INTERVAL_MS);

  const intervalDesc =
    WATCHER_INTERVAL_MS >= 3_600_000
      ? `${WATCHER_INTERVAL_MS / 3_600_000}h`
      : `${WATCHER_INTERVAL_MS / 1_000}s`;

  console.log(`[watcher] started — interval: ${intervalDesc}`);
}

export function stopWatcher(): void {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
