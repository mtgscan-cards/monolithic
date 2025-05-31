// src/workers/frameWorkerSingleton.ts
let worker: Worker | null = null;

export const createFrameWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('./frameWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
};

