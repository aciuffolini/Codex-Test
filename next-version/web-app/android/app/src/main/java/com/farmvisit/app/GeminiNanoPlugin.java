package com.farmvisit.app;

import android.os.Build;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor Plugin for Gemini Nano on-device AI
 * 
 * Note: ML Kit GenAI Generative API (com.google.mlkit:genai-prompt) is still in alpha
 * and may not be available on all devices. This plugin gracefully falls back to
 * returning unavailable status when the API isn't present.
 * 
 * The app will use cloud LLM APIs (OpenAI, Claude, etc.) as fallback.
 */
@CapacitorPlugin(name = "GeminiNano")
public class GeminiNanoPlugin extends Plugin {

    private static final String TAG = "GeminiNano";
    private boolean modelInitialized = false;

    /**
     * Check if device supports Gemini Nano on-device
     * Currently returns unavailable since ML Kit GenAI APIs are in alpha
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();

        // Check Android version (API 34 = Android 14)
        if (Build.VERSION.SDK_INT < 34) { // UPSIDE_DOWN_CAKE
            ret.put("available", false);
            ret.put("reason", "Android 14+ required for on-device AI");
            call.resolve(ret);
            return;
        }

        // ML Kit GenAI APIs are in alpha and may not be available
        // For now, gracefully report unavailable and let app use cloud APIs
        try {
            // Try to load ML Kit GenAI class dynamically
            Class<?> generationClass = Class.forName("com.google.mlkit.genai.generative.Generation");
            
            // If we get here, the class exists - but we still need proper initialization
            android.util.Log.d(TAG, "ML Kit GenAI classes found");
            ret.put("available", false);
            ret.put("reason", "ML Kit GenAI available but initialization pending");
            ret.put("status", "CHECKING");
            
        } catch (ClassNotFoundException e) {
            android.util.Log.w(TAG, "ML Kit GenAI not available: " + e.getMessage());
            ret.put("available", false);
            ret.put("reason", "ML Kit GenAI not available on this device");
            ret.put("status", "UNAVAILABLE");
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error checking availability: " + e.getMessage());
            ret.put("available", false);
            ret.put("reason", "Error: " + e.getMessage());
            ret.put("status", "ERROR");
        }

        call.resolve(ret);
    }

    /**
     * Initialize the model
     * Returns error since ML Kit GenAI APIs are not fully supported yet
     */
    @PluginMethod
    public void initialize(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            call.reject("Android 14+ required for Gemini Nano");
            return;
        }

        // ML Kit GenAI is in alpha - report not available for now
        // App will fall back to cloud APIs
        call.reject("Gemini Nano on-device not available. Use cloud API instead.");
    }

    /**
     * Generate text completion (non-streaming)
     */
    @PluginMethod
    public void generate(PluginCall call) {
        if (!modelInitialized) {
            call.reject("Model not initialized. Gemini Nano may not be available on this device.");
            return;
        }

        String prompt = call.getString("prompt", "");
        if (prompt.isEmpty()) {
            call.reject("Prompt is required");
            return;
        }

        // Not implemented - app uses cloud APIs
        call.reject("On-device generation not available. Use cloud API.");
    }

    /**
     * Stream text completion
     */
    @PluginMethod
    public void stream(PluginCall call) {
        if (!modelInitialized) {
            call.reject("Model not initialized. Gemini Nano may not be available on this device.");
            return;
        }

        String prompt = call.getString("prompt", "");
        if (prompt.isEmpty()) {
            call.reject("Prompt is required");
            return;
        }

        // Not implemented - app uses cloud APIs
        call.reject("On-device streaming not available. Use cloud API.");
    }
}
