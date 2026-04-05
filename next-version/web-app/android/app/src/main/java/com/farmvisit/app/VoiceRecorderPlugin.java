package com.farmvisit.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

/**
 * Native voice recorder that bypasses WebView getUserMedia/MediaRecorder.
 * Uses Android's native MediaRecorder → AAC/M4A → base64 data-URL.
 */
@CapacitorPlugin(name = "VoiceRecorder")
public class VoiceRecorderPlugin extends Plugin {

    private static final String TAG = "VoiceRecorder";
    private MediaRecorder recorder;
    private String tempFilePath;

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission not granted. Go to Settings → Apps → Farm Visit → Permissions.");
            return;
        }

        releaseRecorder();

        try {
            File tempFile = File.createTempFile("voice_", ".m4a", getContext().getCacheDir());
            tempFilePath = tempFile.getAbsolutePath();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                recorder = new MediaRecorder(getContext());
            } else {
                @SuppressWarnings("deprecation")
                MediaRecorder legacy = new MediaRecorder();
                recorder = legacy;
            }

            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setAudioSamplingRate(44100);
            recorder.setOutputFile(tempFilePath);
            recorder.prepare();
            recorder.start();

            android.util.Log.d(TAG, "Recording started → " + tempFilePath);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e(TAG, "startRecording failed", e);
            releaseRecorder();
            call.reject("Failed to start recording: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (recorder == null) {
            call.reject("No active recording");
            return;
        }

        try {
            recorder.stop();
        } catch (RuntimeException e) {
            releaseRecorder();
            call.reject("Recording too short or failed: " + e.getMessage());
            return;
        }

        recorder.release();
        recorder = null;

        try {
            File file = new File(tempFilePath);
            if (!file.exists() || file.length() == 0) {
                call.reject("Recording file is empty");
                return;
            }

            byte[] bytes = readFileBytes(file);
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            String dataUrl = "data:audio/mp4;base64," + base64;

            android.util.Log.d(TAG, "Recording stopped, size=" + bytes.length);
            file.delete();

            JSObject ret = new JSObject();
            ret.put("dataUrl", dataUrl);
            ret.put("mimeType", "audio/mp4");
            ret.put("size", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e(TAG, "stopRecording read failed", e);
            call.reject("Failed to read recording: " + e.getMessage());
        }
    }

    private void releaseRecorder() {
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        if (tempFilePath != null) {
            try { new File(tempFilePath).delete(); } catch (Exception ignored) {}
            tempFilePath = null;
        }
    }

    private byte[] readFileBytes(File file) throws IOException {
        byte[] bytes = new byte[(int) file.length()];
        FileInputStream fis = new FileInputStream(file);
        try {
            int offset = 0;
            while (offset < bytes.length) {
                int read = fis.read(bytes, offset, bytes.length - offset);
                if (read < 0) break;
                offset += read;
            }
        } finally {
            fis.close();
        }
        return bytes;
    }
}
