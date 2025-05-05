// src/scanner/imageProcessing.ts
import cv from '@techstark/opencv-js';

export const TARGET_SIZE = 224;
export const CENTER_MARGIN_RATIO = 0.050; // 5%

export const scaleAndCropImage = (
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): { canvas: HTMLCanvasElement; scale: number; cropX: number; cropY: number } => {
  const iw = sourceCanvas.width;
  const ih = sourceCanvas.height;
  const scale = Math.max(targetWidth / iw, targetHeight / ih);
  const nw = Math.floor(iw * scale);
  const nh = Math.floor(ih * scale);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = nw;
  scaledCanvas.height = nh;
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) throw new Error("Couldn't get 2d context for scaled canvas.");
  scaledCtx.drawImage(sourceCanvas, 0, 0, iw, ih, 0, 0, nw, nh);

  const cropX = Math.floor((nw - targetWidth) / 2);
  const cropY = Math.floor((nh - targetHeight) / 2);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = targetWidth;
  cropCanvas.height = targetHeight;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error("Couldn't get 2d context for crop canvas.");
  cropCtx.drawImage(
    scaledCanvas,
    cropX,
    cropY,
    targetWidth,
    targetHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return { canvas: cropCanvas, scale, cropX, cropY };
};

export const uncropPoint = (
  croppedPt: [number, number],
  scale: number,
  cropX: number,
  cropY: number
): [number, number] => {
  const xCropped = croppedPt[0] * TARGET_SIZE;
  const yCropped = croppedPt[1] * TARGET_SIZE;
  const xOrig = (xCropped + cropX) / scale;
  const yOrig = (yCropped + cropY) / scale;
  return [xOrig, yOrig];
};

export const findLargestQuadrilateral = (
  maskData: Uint8Array,
  width: number,
  height: number,
  epsilonMultiplier: number = 0.02
): [number, number][] | null => {
  const maskMat = cv.matFromArray(height, width, cv.CV_8UC1, Array.from(maskData));
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(maskMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  if (contours.size() === 0) {
    maskMat.delete(); contours.delete(); hierarchy.delete();
    return null;
  }

  // pick the largest contour
  let largestContour: cv.Mat | null = null;
  let maxArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > maxArea) {
      maxArea = area;
      largestContour = cnt;
    }
  }

  let quad: [number, number][] | null = null;
  if (largestContour) {
    const peri = cv.arcLength(largestContour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(largestContour, approx, epsilonMultiplier * peri, true);

    // if >4, try a tighter epsilon; if <4, we'll handle below
    if (approx.rows > 4) {
      cv.approxPolyDP(largestContour, approx, epsilonMultiplier * peri * 1.5, true);
    }

    const pts: [number, number][] = [];
    for (let i = 0; i < approx.rows; i++) {
      const p = approx.intPtr(i, 0);
      pts.push([p[0] / width, p[1] / height]);
    }
    approx.delete();

    // --- If we have exactly 3 points, predict the 4th ---
    if (pts.length === 3) {
      // 1. compute centroid
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      // 2. sort clockwise around centroid
      pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      const [A, B, C] = pts;
      // 3. assume parallelogram → D = A + C - B
      const D: [number, number] = [A[0] + C[0] - B[0], A[1] + C[1] - B[1]];
      pts.push(D);
    }

    // Only accept exactly four after any fix
    if (pts.length === 4) {
      // 1. compute centroid of all 4
      const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
      const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
      // 2. sort them consistently (clockwise)
      pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      quad = pts;
      // filter out absurdly large shapes
      if (polygonArea(quad) > 0.8) quad = null;
    }
  }

  maskMat.delete();
  contours.delete();
  hierarchy.delete();
  if (largestContour) largestContour.delete();
  return quad;
};

export const polygonArea = (points: [number, number][]): number => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
};

export const getROICanvas = (
  quad: [number, number][] | null,
  sourceCanvas: HTMLCanvasElement
): HTMLCanvasElement | null => {
  if (!quad) return null;
  const xs = quad.map(([x]) => x);
  const ys = quad.map(([, y]) => y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = Math.max(...xs) - minX,
    height = Math.max(...ys) - minY;
  if (width <= 0 || height <= 0) return null;
  const roiCanvas = document.createElement('canvas');
  roiCanvas.width = width;
  roiCanvas.height = height;
  const ctx = roiCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(sourceCanvas, minX, minY, width, height, 0, 0, width, height);
  return roiCanvas;
};

export const computeFocusScore = (canvas: HTMLCanvasElement): number => {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const lap = new cv.Mat();
  cv.Laplacian(gray, lap, cv.CV_64F);
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  cv.meanStdDev(lap, mean, stddev);
  const score = stddev.doubleAt(0, 0) ** 2;
  src.delete(); gray.delete(); lap.delete(); mean.delete(); stddev.delete();
  return score;
};

export const isQuadCentered = (
  quad: [number, number][],
  videoWidth: number,
  videoHeight: number
): boolean => {
  const xs = quad.map(([x]) => x),
        ys = quad.map(([,y]) => y);
  const mX = videoWidth * CENTER_MARGIN_RATIO,
        mY = videoHeight * CENTER_MARGIN_RATIO;
  return (
    Math.min(...xs) >= mX &&
    Math.max(...xs) <= videoWidth - mX &&
    Math.min(...ys) >= mY &&
    Math.max(...ys) <= videoHeight - mY
  );
};

export const isROIValid = (
  quad: [number, number][],
  videoWidth: number,
  videoHeight: number
): boolean => {
  const inFrame = quad.every(([x,y]) => x >= 0 && y >= 0 && x <= videoWidth && y <= videoHeight);
  const area = polygonArea(quad);
  return inFrame && area >= videoWidth * videoHeight * 0.05;
};
