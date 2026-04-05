/**
 * Sensor Provider Interface
 * Defines the contract for all sensor providers (Android, Web, Ray-Ban)
 */

export type SensorSource = 'phone' | 'glasses';

export interface GPSLocation {
  lat: number;
  lon: number;
  acc: number; // accuracy in meters
  alt?: number; // altitude in meters
  ts: number; // timestamp
}

export interface PhotoResult {
  dataUrl: string;
  path?: string; // Native file path (Android only)
  width: number;
  height: number;
}

export interface CameraOptions {
  quality?: number; // 0-100
  allowEditing?: boolean;
  resultType?: 'base64' | 'uri' | 'dataUrl';
  source?: 'camera' | 'photos' | 'prompt';
}

export interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt';
  microphone: 'granted' | 'denied' | 'prompt';
  geolocation: 'granted' | 'denied' | 'prompt';
}

/**
 * Unified interface for all sensor providers
 * Works with Android (Capacitor), Web APIs, and future Ray-Ban Gen 2
 */
export interface ISensorProvider {
  // GPS
  getGPS(): Promise<GPSLocation>;
  watchGPS(callback: (loc: GPSLocation) => void): Promise<string>; // Returns watch ID
  clearWatch(watchId: string): void;
  
  // Camera
  capturePhoto(options?: CameraOptions): Promise<PhotoResult>;
  
  // Microphone (Audio Recording)
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>; // Returns audio file path or dataUrl
  
  // Speaker (Audio Playback)
  playAudio(url: string): Promise<void>;
  stopAudio(): void;
  
  // Permissions
  requestPermissions(): Promise<PermissionStatus>;
  checkPermissions(): Promise<PermissionStatus>;
}


