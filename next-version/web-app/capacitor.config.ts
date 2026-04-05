/**
 * Capacitor Configuration — vNext variant
 * Separate appId from baseline to allow side-by-side install
 */

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.farmvisit.appii',
  appName: 'Farm Visit App II',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    Camera: {
      permissions: {
        camera: 'Camera access required to capture field photos',
      },
    },
    Geolocation: {
      permissions: {
        coarseLocation: 'Location access required for GPS tracking',
        fineLocation: 'Precise location access required for accurate field mapping',
      },
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
