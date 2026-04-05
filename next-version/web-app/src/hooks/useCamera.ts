/**
 * React Hook for Camera Access
 * Uses SensorManager for platform-agnostic camera access
 */

import { useState } from 'react';
import { SensorManager } from '../lib/sensors/SensorManager';
import { PhotoResult, CameraOptions } from '../lib/sensors/ISensorProvider';

export function useCamera() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const manager = SensorManager.getInstance();

  const capturePhoto = async (options?: CameraOptions): Promise<PhotoResult> => {
    setLoading(true);
    try {
      const result = await manager.capturePhoto(options);
      setPhoto(result.dataUrl);
      return result;
    } catch (err) {
      console.error('Camera error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
  };

  return { photo, loading, capturePhoto, clearPhoto };
}


