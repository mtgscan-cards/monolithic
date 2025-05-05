import React, { useState } from 'react';
import { opencvWorkerManager } from '../opencvWorker';

const OpenCVProcessor: React.FC = () => {
  const [result, setResult] = useState<ImageData | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = async () => {
      // Create a temporary canvas to draw the image.
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      // Get the image data.
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Process the image in the worker.
      const processed = await opencvWorkerManager.process(imageData);
      setResult(processed);
    };
  };

  return (
    <div>
      <h2>OpenCV Processor</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {result && (
        <div>
          <h3>Processed Image</h3>
          <canvas
            ref={(canvas) => {
              if (canvas && result) {
                canvas.width = result.width;
                canvas.height = result.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.putImageData(result, 0, 0);
                }
              }
            }}
            style={{ border: '1px solid #ccc' }}
          />
        </div>
      )}
    </div>
  );
};

export default OpenCVProcessor;
