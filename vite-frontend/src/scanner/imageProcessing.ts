// src/scanner/imageProcessing.ts
import cv from '@techstark/opencv-js';

export const TARGET_SIZE = 224;
export const CENTER_MARGIN_RATIO = 0.050; // 5%

const reusableCanvas = document.createElement('canvas');
const reusableCtx = reusableCanvas.getContext('2d');

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

  reusableCanvas.width = nw;
  reusableCanvas.height = nh;
  const scaledCtx = reusableCtx;
  if (!scaledCtx) throw new Error("Couldn't get 2d context for reusable canvas.");
  scaledCtx.clearRect(0, 0, nw, nh);
  scaledCtx.drawImage(sourceCanvas, 0, 0, iw, ih, 0, 0, nw, nh);

  const cropX = Math.floor((nw - targetWidth) / 2);
  const cropY = Math.floor((nh - targetHeight) / 2);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = targetWidth;
  cropCanvas.height = targetHeight;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error("Couldn't get 2d context for crop canvas.");
  cropCtx.drawImage(
    reusableCanvas,
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
  const maskMat = cv.matFromArray(height, width, cv.CV_8UC1, maskData);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let largestContour: cv.Mat | null = null;
  let quad: [number, number][] | null = null;

  try {
    cv.findContours(maskMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    if (contours.size() === 0) return null;

    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > maxArea) {
        maxArea = area;
        if (largestContour) largestContour.delete();
        largestContour = cnt;
      } else {
        cnt.delete();
      }
    }

    if (largestContour) {
      const peri = cv.arcLength(largestContour, true);
      let approx = new cv.Mat();
      cv.approxPolyDP(largestContour, approx, epsilonMultiplier * peri, true);

      if (approx.rows > 4) {
        approx.delete();
        const tighter = new cv.Mat();
        cv.approxPolyDP(largestContour, tighter, epsilonMultiplier * peri * 1.5, true);
        approx = tighter;
      }
      const pts: [number, number][] = [];
      for (let i = 0; i < approx.rows; i++) {
        const p = approx.intPtr(i, 0);
        pts.push([p[0] / width, p[1] / height]);
      }

      if (pts.length === 3) {
        const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
        const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
        pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
        const [A, B, C] = pts;
        pts.push([A[0] + C[0] - B[0], A[1] + C[1] - B[1]]);
      }

      if (pts.length === 4) {
        const cx = pts.reduce((sum, [x]) => sum + x, 0) / 4;
        const cy = pts.reduce((sum, [, y]) => sum + y, 0) / 4;
        pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
        if (polygonArea(pts) <= 0.8) quad = pts;
      }

      approx.delete();
    }
  } finally {
    maskMat.delete();
    contours.delete();
    hierarchy.delete();
    if (largestContour) largestContour.delete();
  }

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
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of quad) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
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
  const lap = new cv.Mat();
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Laplacian(gray, lap, cv.CV_64F);
    cv.meanStdDev(lap, mean, stddev);
    return stddev.doubleAt(0, 0) ** 2;
  } finally {
    src.delete(); gray.delete(); lap.delete(); mean.delete(); stddev.delete();
  }
};

export const isQuadCentered = (
  quad: [number, number][],
  videoWidth: number,
  videoHeight: number
): boolean => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of quad) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const mX = videoWidth * CENTER_MARGIN_RATIO;
  const mY = videoHeight * CENTER_MARGIN_RATIO;
  return (
    minX >= mX && maxX <= videoWidth - mX &&
    minY >= mY && maxY <= videoHeight - mY
  );
};

export const isROIValid = (
  quad: [number, number][],
  videoWidth: number,
  videoHeight: number
): boolean => {
  const inFrame = quad.every(([x, y]) => x >= 0 && y >= 0 && x <= videoWidth && y <= videoHeight);
  const area = polygonArea(quad);
  return inFrame && area >= videoWidth * videoHeight * 0.05;
};
