/**
 * React Hook for Microphone/Audio Recording
 * Uses SensorManager for platform-agnostic audio recording
 */

import { useState } from 'react';
import { SensorManager } from '../lib/sensors/SensorManager';

export function useMicrophone() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const manager = SensorManager.getInstance();

  const startRecording = async () => {
    try {
      console.log('[useMicrophone] Starting recording...');
      await manager.startRecording();
      setRecording(true);
      setAudioUrl(null);
      console.log('[useMicrophone] Recording started successfully');
    } catch (err: any) {
      console.error('[useMicrophone] Recording error:', err);
      alert(`Failed to start recording: ${err.message || 'Unknown error'}\n\nPlease check microphone permissions in your device settings.`);
      throw err;
    }
  };

  const stopRecording = async (): Promise<string> => {
    setLoading(true);
    try {
      console.log('[useMicrophone] Stopping recording...');
      const url = await manager.stopRecording();
      console.log('[useMicrophone] Recording stopped, audio URL:', url ? 'generated' : 'missing');
      setAudioUrl(url);
      setRecording(false);
      return url;
    } catch (err: any) {
      console.error('[useMicrophone] Stop recording error:', err);
      setRecording(false);
      alert(`Failed to stop recording: ${err.message || 'Unknown error'}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearAudio = () => {
    setAudioUrl(null);
  };

  return { recording, audioUrl, loading, startRecording, stopRecording, clearAudio };
}

