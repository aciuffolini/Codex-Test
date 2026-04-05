/**
 * Android Sensor Provider
 * Uses Capacitor plugins for native Android sensor access.
 * Audio recording uses a native VoiceRecorder plugin that bypasses WebView
 * getUserMedia/MediaRecorder entirely — those APIs are unreliable in Android
 * WebViews and produce "Could not start audio source" on many devices.
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { ISensorProvider, GPSLocation, PhotoResult, CameraOptions, PermissionStatus } from './ISensorProvider';
import VoiceRecorder from '../plugins/VoiceRecorder';

let _preferredAudioDeviceId: string | undefined;

export function setPreferredAudioDeviceAndroid(deviceId: string | undefined) {
  _preferredAudioDeviceId = deviceId;
}

export class AndroidProvider implements ISensorProvider {
  private currentAudio: HTMLAudioElement | null = null;
  private gpsWatchId: string | null = null;

  async getGPS(): Promise<GPSLocation> {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000,
    });

    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      acc: Math.round(position.coords.accuracy || 0),
      alt: position.coords.altitude || undefined,
      ts: Date.now(),
    };
  }

  async watchGPS(callback: (loc: GPSLocation) => void): Promise<string> {
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
      (position: Position | null) => {
        if (position) {
          callback({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            acc: Math.round(position.coords.accuracy || 0),
            alt: position.coords.altitude || undefined,
            ts: Date.now(),
          });
        }
      }
    );
    
    this.gpsWatchId = watchId;
    return watchId;
  }

  clearWatch(watchId: string): void {
    Geolocation.clearWatch({ id: watchId });
    if (this.gpsWatchId === watchId) {
      this.gpsWatchId = null;
    }
  }

  async capturePhoto(options?: CameraOptions): Promise<PhotoResult> {
    const image = await Camera.getPhoto({
      quality: options?.quality || 90,
      allowEditing: options?.allowEditing || false,
      resultType: CameraResultType.DataUrl,
      source: options?.source === 'photos' ? CameraSource.Photos : CameraSource.Camera,
      correctOrientation: true,
    });

    let width = 0;
    let height = 0;
    const dataUrl = image.dataUrl;
    if (dataUrl) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          width = img.width;
          height = img.height;
          resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }

    return {
      dataUrl: image.dataUrl || '',
      path: image.path || undefined,
      width: width || 0,
      height: height || 0,
    };
  }

  // ── Audio recording via native plugin ──────────────────────────────

  async startRecording(): Promise<void> {
    console.log('[AndroidProvider] Starting native recording...');
    try {
      await VoiceRecorder.startRecording();
      console.log('[AndroidProvider] Native recording started');
    } catch (err: any) {
      console.error('[AndroidProvider] Native startRecording failed:', err);
      const msg = err?.message || 'Unknown error';
      if (/permission/i.test(msg)) {
        throw new Error('Microphone permission denied. Go to Android Settings → Apps → Farm Visit → Permissions and enable Microphone.');
      }
      throw new Error(`Failed to start recording: ${msg}`);
    }
  }

  async stopRecording(): Promise<string> {
    console.log('[AndroidProvider] Stopping native recording...');
    try {
      const result = await VoiceRecorder.stopRecording();
      console.log('[AndroidProvider] Native recording stopped, size:', result.size);
      return result.dataUrl;
    } catch (err: any) {
      console.error('[AndroidProvider] Native stopRecording failed:', err);
      throw new Error(`Failed to stop recording: ${err?.message || 'Unknown error'}`);
    }
  }

  // ── Audio playback (uses HTML5 Audio — works fine in WebView) ──────

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

  // ── Permissions ────────────────────────────────────────────────────

  async requestPermissions(): Promise<PermissionStatus> {
    let cameraStatus: 'granted' | 'denied' = 'denied';
    try {
      const result = await Camera.requestPermissions();
      const permState = result as any;
      cameraStatus = (permState.camera === 'granted') ? 'granted' : 'denied';
    } catch (e) {
      console.warn('Camera permission request failed:', e);
    }

    let geoStatus: 'granted' | 'denied' = 'denied';
    try {
      const geoPerm = await Geolocation.requestPermissions();
      geoStatus = (geoPerm.location === 'granted') ? 'granted' : 'denied';
    } catch (e) {
      console.warn('Geolocation permission request failed:', e);
    }

    // Mic permission is handled natively by MainActivity at startup.
    // Do NOT call getUserMedia here — it causes "audio source busy" on
    // Android WebView.
    let micPerm: 'granted' | 'denied' = 'denied';
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      micPerm = perm.state === 'granted' ? 'granted' : 'denied';
    } catch {
      micPerm = (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ? 'granted' : 'denied';
    }

    return { camera: cameraStatus, microphone: micPerm, geolocation: geoStatus };
  }

  async checkPermissions(): Promise<PermissionStatus> {
    let cameraStatus: 'granted' | 'denied' | 'prompt' = 'prompt';
    try {
      const result = await Camera.checkPermissions();
      const permState = result as any;
      cameraStatus = (permState.camera === 'granted') ? 'granted' : 'denied';
    } catch (e) {
      console.warn('Camera permission check failed:', e);
    }
    
    let geoStatus: 'granted' | 'denied' | 'prompt' = 'prompt';
    try {
      const geoPerm = await Geolocation.checkPermissions();
      geoStatus = (geoPerm.location === 'granted') ? 'granted' : 'denied';
    } catch (e) {
      console.warn('Geolocation permission check failed:', e);
    }
    
    let micPerm: 'granted' | 'denied' | 'prompt' = 'prompt';
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      micPerm = 'prompt';
    } else {
      micPerm = 'denied';
    }

    return { camera: cameraStatus, microphone: micPerm, geolocation: geoStatus };
  }
}
