// src/workers/frameWorkerSingleton.ts

let worker: Worker & { _terminated?: boolean } | null = null;

export const createFrameWorker = (): Worker | null => {
  // If the worker was previously marked as terminated, reset
  if (worker?.['_terminated']) {
    console.warn('[FrameWorker] Detected terminated worker. Reinitializing...');
    worker = null;
  }

  if (!worker) {
    try {
      worker = new Worker(new URL('./frameWorker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onerror = (e) => {
        console.error('[FrameWorker] Worker error:', e.message, e);
      };

      worker.onmessageerror = (e) => {
        console.error('[FrameWorker] Message error in worker:', e);
      };

      worker._terminated = false; // mark explicitly
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[FrameWorker] Failed to create worker:', error);
      worker = null;
    }
  }

  return worker;
};