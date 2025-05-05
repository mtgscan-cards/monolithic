/* eslint-disable @typescript-eslint/no-explicit-any */
import cv from '@techstark/opencv-js';

interface ClahePayload {
  imageBitmap: ImageBitmap;
  width: number;
  height: number;
}

interface SegmentPayload {
  maskData: number[]; // raw mask values (0-255)
  width: number;
  height: number;
}

interface WorkerMessage {
  task: 'clahe' | 'segment';
  payload: ClahePayload | SegmentPayload;
}

interface WorkerResponse {
  task: 'clahe' | 'segment';
  processedImageBitmap?: ImageBitmap;
  processedMaskData?: Uint8Array;
  error?: string;
}

let cvReady = false;

// Initialize OpenCV.
if ('onRuntimeInitialized' in cv) {
  (cv as any).onRuntimeInitialized = () => {
    cvReady = true;
    console.debug('OpenCV Worker: OpenCV is ready.');
  };
} else {
  cvReady = true;
}

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { task, payload } = event.data;
  // Wait until OpenCV is ready.
  while (!cvReady) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (task === 'clahe') {
    // ----- CLAHE / Color Conversion Task -----
    const { imageBitmap, width, height } = payload as ClahePayload;
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      (self as any).postMessage({
        task,
        error: 'No 2D context available in worker.',
      } as WorkerResponse);
      return;
    }
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    try {
      // Instead of using cv.imread (which requires an HTMLCanvasElement),
      // we obtain the ImageData and then create the source Mat.
      const imageData = ctx.getImageData(0, 0, width, height);
      const srcMat = cv.matFromImageData(imageData);
      const labMat = new cv.Mat();
      cv.cvtColor(srcMat, labMat, cv.COLOR_RGB2Lab);
      const labPlanes = new cv.MatVector();
      cv.split(labMat, labPlanes);
      const lChannel = labPlanes.get(0);
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(lChannel, lChannel);
      labPlanes.set(0, lChannel);
      cv.merge(labPlanes, labMat);
      cv.cvtColor(labMat, srcMat, cv.COLOR_Lab2RGB);
      // Convert the processed image to RGBA so that we can create ImageData.
      const dstMat = new cv.Mat();
      cv.cvtColor(srcMat, dstMat, cv.COLOR_RGB2RGBA);
      const processedImageData = new ImageData(
        new Uint8ClampedArray(dstMat.data),
        dstMat.cols,
        dstMat.rows
      );
      ctx.putImageData(processedImageData, 0, 0);
      // Cleanup.
      lChannel.delete();
      clahe.delete();
      labPlanes.delete();
      labMat.delete();
      srcMat.delete();
      dstMat.delete();
      // Transfer the processed image.
      const processedImageBitmap = offscreen.transferToImageBitmap();
      (self as any).postMessage(
        { task, processedImageBitmap } as WorkerResponse,
        [processedImageBitmap]
      );
    } catch (err: any) {
      (self as any).postMessage({ task, error: err.message } as WorkerResponse);
    }
  } else if (task === 'segment') {
    // ----- Segmentation Mask Processing Task -----
    const { maskData, width, height } = payload as SegmentPayload;
    try {
      const maskMat = cv.matFromArray(width, height, cv.CV_8UC1, maskData) as cv.Mat;
      const thresholdMat = new cv.Mat();
      cv.threshold(maskMat, thresholdMat, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
      maskMat.delete();
      const bilateralMat = new cv.Mat();
      cv.bilateralFilter(thresholdMat, bilateralMat, 5, 75, 75, cv.BORDER_DEFAULT);
      thresholdMat.delete();
      const morphMat = new cv.Mat();
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      cv.morphologyEx(bilateralMat, morphMat, cv.MORPH_CLOSE, kernel);
      kernel.delete();
      bilateralMat.delete();
      const processedMaskData = new Uint8Array(morphMat.data);
      morphMat.delete();
      (self as any).postMessage({ task, processedMaskData } as WorkerResponse);
    } catch (err: any) {
      (self as any).postMessage({ task, error: err.message } as WorkerResponse);
    }
  }
});
