/**
 * Web Sensor Provider
 * Fallback implementation using web APIs
 * Used when running in browser (not native Android)
 */

import { ISensorProvider, GPSLocation, PhotoResult, CameraOptions, PermissionStatus } from './ISensorProvider';

let _preferredAudioDeviceId: string | undefined;

export function setPreferredAudioDevice(deviceId: string | undefined) {
  _preferredAudioDeviceId = deviceId;
}

export class WebProvider implements ISensorProvider {
  private audioRecording: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private gpsWatchId: number | null = null;

  async getGPS(): Promise<GPSLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            acc: Math.round(pos.coords.accuracy || 0),
            alt: pos.coords.altitude || undefined,
            ts: Date.now(),
          });
        },
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    });
  }

  async watchGPS(callback: (loc: GPSLocation) => void): Promise<string> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        callback({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy || 0),
          alt: pos.coords.altitude || undefined,
          ts: Date.now(),
        });
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    this.gpsWatchId = watchId;
    return watchId.toString();
  }

  clearWatch(watchId: string): void {
    if (this.gpsWatchId !== null && this.gpsWatchId.toString() === watchId) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
  }

  async capturePhoto(options?: CameraOptions): Promise<PhotoResult> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (options?.source !== 'photos') {
        input.capture = 'environment';
      }

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            resolve({
              dataUrl: event.target?.result as string,
              width: img.width,
              height: img.height,
            });
          };
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  async startRecording(): Promise<void> {
    console.log('[WebProvider] Starting recording...');

    // Check MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    try {
      let stream: MediaStream;
      const preferredDeviceId = _preferredAudioDeviceId;
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : {}),
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (constraintErr) {
        console.warn('[WebProvider] Audio constraints failed, using fallback:', constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      console.log('[WebProvider] Media stream obtained', preferredDeviceId ? `(device: ${preferredDeviceId})` : '(default)');

      // Find supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('[WebProvider] Using MIME type:', mimeType);
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }
      this.audioRecording = new MediaRecorder(stream, recorderOptions);
      this.audioChunks = [];

      this.audioRecording.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('[WebProvider] Data available:', event.data.size, 'bytes');
          this.audioChunks.push(event.data);
        }
      };

      this.audioRecording.onerror = (event: any) => {
        console.error('[WebProvider] MediaRecorder error:', event.error);
      };

      this.audioRecording.onstart = () => {
        console.log('[WebProvider] Recording started');
      };

      this.audioRecording.onstop = () => {
        console.log('[WebProvider] Recording stopped, chunks:', this.audioChunks.length);
      };

      // Start recording with timeslice to get chunks periodically
      this.audioRecording.start(1000);
      console.log('[WebProvider] Recording started successfully');
    } catch (err: any) {
      console.error('[WebProvider] Start recording error:', err);
      throw new Error(`Failed to start recording: ${err.message || 'Unknown error'}`);
    }
  }

  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.audioRecording) {
        console.warn('[WebProvider] No active recording to stop');
        reject(new Error('No active recording'));
        return;
      }

      console.log('[WebProvider] Stopping recording...');

      // Set up stop handler before stopping
      const onStopHandler = async () => {
        try {
          console.log('[WebProvider] Processing audio chunks:', this.audioChunks.length);

          if (this.audioChunks.length === 0) {
            reject(new Error('No audio data recorded'));
            return;
          }

          // Determine MIME type from chunks or use default
          const mimeType = this.audioRecording?.mimeType || 'audio/webm';
          console.log('[WebProvider] Creating blob with type:', mimeType);

          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          console.log('[WebProvider] Blob created, size:', audioBlob.size, 'bytes');

          if (audioBlob.size === 0) {
            reject(new Error('Recorded audio is empty'));
            return;
          }

          const reader = new FileReader();

          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            console.log('[WebProvider] Audio data URL generated, length:', dataUrl.length);
            resolve(dataUrl);
          };

          reader.onerror = (error) => {
            console.error('[WebProvider] FileReader error:', error);
            reject(new Error('Failed to read audio data'));
          };

          reader.readAsDataURL(audioBlob);

          // Stop all tracks
          if (this.audioRecording?.stream) {
            this.audioRecording.stream.getTracks().forEach(track => {
              track.stop();
              console.log('[WebProvider] Stopped track:', track.kind);
            });
          }

          this.audioRecording = null;
          this.audioChunks = [];
        } catch (err: any) {
          console.error('[WebProvider] Error in stop handler:', err);
          reject(err);
        }
      };

      // Remove previous onstop handler if any and set new one
      this.audioRecording.onstop = onStopHandler;

      // Request final data chunk before stopping
      try {
        this.audioRecording.requestData();
      } catch (e) {
        console.warn('[WebProvider] requestData() not supported, continuing...');
      }

      // Stop recording
      this.audioRecording.stop();
    });
  }

  async playAudio(url: string): Promise<void> {
    this.stopAudio();
    this.currentAudio = new Audio(url);
    await this.currentAudio.play();
  }

  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    // Request microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('Microphone permission denied');
    }

    return await this.checkPermissions();
  }

  async checkPermissions(): Promise<PermissionStatus> {
    const hasMediaDevices = !!navigator.mediaDevices;

    return {
      camera: 'prompt', // Web can't check camera permission statically
      microphone: hasMediaDevices ? 'prompt' : 'denied',
      geolocation: navigator.geolocation ? 'prompt' : 'denied',
    };
  }
}

