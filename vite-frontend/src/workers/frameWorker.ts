// src/workers/frameWorker.ts
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-wasm';

setWasmPaths('/');

let model: tf.GraphModel | null = null;
let backendReady = false;
let modelReady = false;

const inferQueue: MessageEvent[] = [];

// === Load Backend and Model Immediately ===
(async () => {
  if (!backendReady) {
    console.log('[Worker] Setting backend to webgl...');
    await tf.setBackend('webgl');
    await tf.ready();
    backendReady = true;
    console.log('[Worker] Backend ready.');
  }

  try {
    console.log('[Worker] Loading model...');
    model = await tf.loadGraphModel('/web_model/model.json');
    modelReady = true;
    console.log('[Worker] Model loaded.');
    self.postMessage({ type: 'model-loaded' });

    // Drain any queued inference requests
    while (inferQueue.length > 0) {
      handleMessage(inferQueue.shift()!);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Worker] Model load failed:', error);
    self.postMessage({ type: 'error', error });
  }
})();

// === Handle Messages ===
self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'infer' && !modelReady) {
    inferQueue.push(e); // Queue until ready
  } else {
    handleMessage(e);
  }
};

function handleMessage(e: MessageEvent) {
  const { type, bitmap, scale, cropX, cropY } = e.data;

  if (type === 'infer') {
    if (!model) {
      console.warn('[Worker] Inference skipped — model not ready');
      return;
    }

    try {
      console.log('[Worker] Running inference...');
      const input = tf.tidy(() =>
        tf.browser.fromPixels(bitmap).toFloat().div(255).expandDims(0)
      );

      const [heatmaps, coordsT] = model.execute(input) as tf.Tensor[];

      const heat = heatmaps.squeeze();
      const confTensor = heat.max([0, 1]);
      confTensor.array().then((confidences) => {
        coordsT.squeeze().array().then((coords) => {
          tf.dispose([input, heatmaps, coordsT, heat, confTensor]);
          self.postMessage({
            type: 'result',
            confidences,
            coords,
            scale,
            cropX,
            cropY,
          });
        });
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Inference error:', error);
      self.postMessage({ type: 'error', error });
    }
  }
}