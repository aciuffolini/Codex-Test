package com.farmvisit.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.farmvisit.app.GeminiNanoPlugin;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSIONS_REQUEST_CODE = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GeminiNanoPlugin.class);
        registerPlugin(VoiceRecorderPlugin.class);
        super.onCreate(savedInstanceState);
        requestCriticalPermissions();
    }

    @Override
    public void onStart() {
        super.onStart();
        installWebViewPermissionBridge();
    }

    private void requestCriticalPermissions() {
        String[] needed = {
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION
        };

        boolean anyMissing = false;
        for (String perm : needed) {
            if (ContextCompat.checkSelfPermission(this, perm)
                    != PackageManager.PERMISSION_GRANTED) {
                anyMissing = true;
                break;
            }
        }

        if (anyMissing) {
            ActivityCompat.requestPermissions(this, needed, PERMISSIONS_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
            @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSIONS_REQUEST_CODE) {
            installWebViewPermissionBridge();
        }
    }

    /**
     * Install a WebChromeClient that auto-grants RESOURCE_AUDIO_CAPTURE and
     * RESOURCE_VIDEO_CAPTURE when the corresponding Android runtime permission
     * is already granted.  Retries with a short delay if the Capacitor bridge
     * is not yet initialised (it is set up asynchronously by BridgeActivity).
     */
    private void installWebViewPermissionBridge() {
        if (bridge == null || bridge.getWebView() == null) {
            new Handler(Looper.getMainLooper()).postDelayed(this::tryInstallBridge, 500);
        } else {
            tryInstallBridge();
        }
    }

    private void tryInstallBridge() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    boolean needsAudio = false;
                    boolean needsVideo = false;

                    for (String resource : resources) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            needsAudio = true;
                        }
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            needsVideo = true;
                        }
                    }

                    boolean audioOk = !needsAudio || ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED;

                    boolean cameraOk = !needsVideo || ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED;

                    if (audioOk && cameraOk) {
                        request.grant(resources);
                    } else {
                        request.deny();
                    }
                });
            }
        });
    }
}
