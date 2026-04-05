import { registerPlugin } from '@capacitor/core';

export interface VoiceRecorderPlugin {
  startRecording(): Promise<void>;
  stopRecording(): Promise<{ dataUrl: string; mimeType: string; size: number }>;
}

const VoiceRecorder = registerPlugin<VoiceRecorderPlugin>('VoiceRecorder');

export default VoiceRecorder;
