// src/workers/frameWorker.ts
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-wasm';

setWasmPaths('/');

let model: tf.GraphModel | null = null;
let backendReady = false;
let modelReady = false;
const inferQueue: MessageEvent[] = [];

// === Load Backend and Model ===
async function initBackendAndModel() {
  if (!backendReady) {
    try {
      console.log('[Worker] Setting backend to webgl...');
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('[Worker] WebGL backend ready.');
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn('[Worker] WebGL backend failed:', error);
      console.log('[Worker] Falling back to WASM backend...');

      try {
        await tf.setBackend('wasm');
        await tf.ready();
        console.log('[Worker] WASM backend ready.');
      } catch (wasmErr) {
        const wasmError = wasmErr instanceof Error ? wasmErr.message : String(wasmErr);
        console.error('[Worker] WASM backend also failed:', wasmError);
        self.postMessage({ type: 'error', error: 'All TFJS backends failed to initialize' });
        return;
      }
    }

    backendReady = true;
  }

  if (!modelReady) {
    try {
      console.log('[Worker] Loading model...');
      model = await tf.loadGraphModel('/web_model/model.json');
      modelReady = true;
      console.log('[Worker] Model loaded.');
      self.postMessage({ type: 'model-loaded' });

      // Drain queued inferences
      while (inferQueue.length > 0) {
        handleMessage(inferQueue.shift()!);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Model load failed:', error);
      self.postMessage({ type: 'error', error });
    }
  }
}

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'loadModel') {
    initBackendAndModel();
    return;
  }

  if (!modelReady) {
    inferQueue.push(e);
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
      const input = tf.tidy(() =>
        tf.browser.fromPixels(bitmap).toFloat().div(255).expandDims(0)
      );

      bitmap.close(); // Important: release memory

      const [heatmaps, coordsT] = model.execute(input) as tf.Tensor[];

      const heat = heatmaps.squeeze(); // [H, W, 4]
      const confTensor = heat.max([0, 1]); // [4]

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