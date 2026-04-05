/**
 * SIMPLE GPS Hook - Direct implementation, no complex abstraction
 * Works on web and Android
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export interface GPSLocation {
  lat: number;
  lon: number;
  acc: number;
  ts: number;
}

export function useGPS() {
  const [gps, setGps] = useState<GPSLocation | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getGPS = async () => {
    setLoading(true);
    setError('');
    
    try {
      let location: GPSLocation;

      if (Capacitor.isNativePlatform()) {
        // Android/iOS - Use Capacitor
        const { Geolocation } = await import('@capacitor/geolocation');
        
        // Request permissions first
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location !== 'granted') {
          throw new Error('Location permission denied');
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          acc: position.coords.accuracy || 0,
          ts: position.timestamp || Date.now(),
        };
      } else {
        // Web - Use browser geolocation
        if (!navigator.geolocation) {
          throw new Error('Geolocation not supported in this browser');
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        });

        location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          acc: position.coords.accuracy || 0,
          ts: Date.now(),
        };
      }

      console.log('[GPS] Location obtained:', location);
      setGps(location);
      setError('');
    } catch (err: any) {
      console.error('[GPS] Error:', err);
      const errorMsg = err.message || 'Failed to get GPS location';
      setError(errorMsg);
      setGps(null);
      
      // Provide helpful error messages
      if (errorMsg.includes('permission')) {
        setError('Location permission denied. Please enable location access in browser/device settings.');
      } else if (errorMsg.includes('timeout')) {
        setError('GPS timeout. Make sure you have a clear view of the sky and try again.');
      } else if (errorMsg.includes('not supported')) {
        setError('Geolocation not supported. Use a modern browser or Android device.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-get GPS on mount (optional - can be disabled)
  useEffect(() => {
    // Don't auto-get, let user click button
    // getGPS();
  }, []);

  return { gps, error, loading, getGPS };
}
