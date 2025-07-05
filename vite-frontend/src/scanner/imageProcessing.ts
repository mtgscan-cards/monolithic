// src/scanner/imageProcessing.ts

import { isoContours } from 'marchingsquares';
import simplify from 'simplify-js';

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
  if (!reusableCtx) throw new Error("Couldn't get 2d context for reusable canvas.");
  reusableCtx.clearRect(0, 0, nw, nh);
  reusableCtx.drawImage(sourceCanvas, 0, 0, iw, ih, 0, 0, nw, nh);

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
  const threshold = 128;
  const binaryGrid: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(maskData[y * width + x] > threshold ? 1 : 0);
    }
    binaryGrid.push(row);
  }

  const contours = isoContours(binaryGrid, 0.5);
  if (contours.length === 0) return null;

  // Helper to convert flat array to array of [number, number]
function toPairs(arr: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push([arr[i + 1], arr[i]]); // SWAPPED to correct interpretation
  }
  return pairs;
}

  // Correctly access the first ring of the first polygon
  let largest = toPairs(contours[0].coordinates[0]);
  let maxArea = polygonAreaNormalized(largest, width, height);

  for (const c of contours) {
    for (const poly of c.coordinates) {
      const ring = toPairs(poly);
      const area = polygonAreaNormalized(ring, width, height);
      if (area > maxArea) {
        maxArea = area;
        largest = ring;
      }
    }
  }

  const simplified = simplify(
    largest.map(([x, y]) => ({ x, y })),
    epsilonMultiplier * Math.sqrt(width * width + height * height),
    true
  );

  if (simplified.length < 3) return null;

  // FRAME-RELATIVE NORMALIZATION
  const pts: [number, number][] = simplified.map(({ x, y }) => [
    x / width,
    y / height
  ]);

  // Sort and ensure quadrilateral
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
    return pts;
  }

  return null;
};

const polygonAreaNormalized = (points: [number, number][], width: number, height: number): number => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += (x1 * y2 - x2 * y1);
  }
  return Math.abs(area) / (2 * width * height);
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
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Couldn't get 2d context.");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }

  const laplacianKernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const laplacian = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          const weight = laplacianKernel[(ky + 1) * 3 + (kx + 1)];
          sum += pixel * weight;
        }
      }
      laplacian[y * width + x] = sum;
    }
  }

  let mean = 0;
  for (const val of laplacian) mean += val;
  mean /= laplacian.length;

  let variance = 0;
  for (const val of laplacian) {
    const diff = val - mean;
    variance += diff * diff;
  }
  variance /= laplacian.length;

  return variance;
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
