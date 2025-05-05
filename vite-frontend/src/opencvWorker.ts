export interface OpenCVRequest {
    id: string;
    imageData: ImageData;
  }
  
  export interface OpenCVResponse {
    id: string;
    result: ImageData;
  }
  
  class OpenCVWorkerManager {
    private worker: Worker;
    private callbacks: Map<string, (result: ImageData) => void> = new Map();
  
    constructor() {
      // Create the worker using a URL so that bundlers (e.g. webpack or Vite) know how to bundle it.
      this.worker = new Worker(new URL('./opencv.worker.ts', import.meta.url));
      // Listen for messages from the worker.
      this.worker.onmessage = (e) => {
        const data = e.data as OpenCVResponse | { type: string };
        if ('type' in data && data.type === 'opencv_ready') {
          console.log('OpenCV is ready in the worker.');
          return;
        }
        const { id, result } = data as OpenCVResponse;
        const callback = this.callbacks.get(id);
        if (callback) {
          callback(result);
          this.callbacks.delete(id);
        }
      };
    }
  
    process(imageData: ImageData): Promise<ImageData> {
      const id = crypto.randomUUID();
      const request: OpenCVRequest = { id, imageData };
      return new Promise((resolve) => {
        this.callbacks.set(id, resolve);
        this.worker.postMessage(request);
      });
    }
  }
  
  export const opencvWorkerManager = new OpenCVWorkerManager();
  