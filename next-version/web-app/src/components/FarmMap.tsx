/**
 * Farm Map Component
 * Displays OSM tiles with KMZ overlay and GPS marker
 * KMZ overlay should superimpose over Google Earth-style tiles
 */

import React, { useEffect, useRef, useState } from 'react';
import { KMZData } from '../lib/map/KMZLoader';

interface FarmMapProps {
  gps?: { lat: number; lon: number; acc: number };
  kmzData?: KMZData | null;
  onKMZLoad?: (data: KMZData) => void;
}

export function FarmMap({ gps, kmzData, onKMZLoad }: FarmMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesLoadedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Default center (Buenos Aires) or use GPS, or use KMZ bounds
  const getCenter = () => {
    if (kmzData) {
      // Center on KMZ bounds
      const centerLat = (kmzData.bounds.north + kmzData.bounds.south) / 2;
      const centerLon = (kmzData.bounds.east + kmzData.bounds.west) / 2;
      return { lat: centerLat, lon: centerLon };
    }
    return gps || { lat: -34.603722, lon: -58.381592 };
  };

  const center = getCenter();
  const zoom = 15;
  const tileSize = 256;
  const tilesPerSide = 3;
  const canvasSize = tileSize * tilesPerSide;

  // Load and cache tiles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const { x, y } = latLonToTile(center.lat, center.lon, zoom);
    let loadedTiles = 0;
    const totalTiles = tilesPerSide * tilesPerSide;

    // Load and draw tiles
    const loadTile = (tx: number, ty: number, offsetX: number, offsetY: number) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, offsetX, offsetY, tileSize, tileSize);
        loadedTiles++;
        if (loadedTiles === totalTiles) {
          tilesLoadedRef.current = true;
          setMapLoaded(true);
          // Redraw overlays after tiles are loaded
          drawOverlays();
        }
      };
      img.onerror = () => {
        // Draw placeholder on error
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(offsetX, offsetY, tileSize, tileSize);
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(offsetX, offsetY, tileSize, tileSize);
        ctx.fillStyle = '#999';
        ctx.font = '12px sans-serif';
        ctx.fillText('Tile error', offsetX + 10, offsetY + 20);
        
        loadedTiles++;
        if (loadedTiles === totalTiles) {
          tilesLoadedRef.current = true;
          setMapLoaded(true);
          drawOverlays();
        }
      };
      img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
    };

    // Draw 3x3 grid of tiles
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tileX = x + dx;
        const tileY = y + dy;
        const offsetX = (dx + 1) * tileSize;
        const offsetY = (dy + 1) * tileSize;
        loadTile(tileX, tileY, offsetX, offsetY);
      }
    }
  }, [center.lat, center.lon, zoom, canvasSize, tilesPerSide, tileSize]);

  // Draw overlays function
  const drawOverlays = () => {
    const canvas = canvasRef.current;
    if (!canvas || !tilesLoadedRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = latLonToTile(center.lat, center.lon, zoom);
    const originX = (x - 1) * tileSize;
    const originY = (y - 1) * tileSize;

    // Draw KMZ polygons/lines (overlay over tiles)
    if (kmzData && kmzData.placemarks.length > 0) {
      kmzData.placemarks.forEach(placemark => {
        if (placemark.coordinates.length === 0) return;

        // Set style for overlay
        ctx.strokeStyle = '#22c55e';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.25)'; // Semi-transparent green
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        let firstPoint = true;

        placemark.coordinates.forEach((coord) => {
          const px = latLonToPixel(coord.lat, coord.lon, zoom);
          const screenX = px.x - originX;
          const screenY = px.y - originY;

          if (firstPoint) {
            ctx.moveTo(screenX, screenY);
            firstPoint = false;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        });

        if (placemark.type === 'polygon') {
          ctx.closePath();
          ctx.fill(); // Fill first, then stroke (so stroke is on top)
        }
        ctx.stroke();
      });
    }

    // Draw GPS marker (overlay on top)
    if (gps) {
      const px = latLonToPixel(gps.lat, gps.lon, zoom);
      const screenX = px.x - originX;
      const screenY = px.y - originY;

      // Draw accuracy circle first
      const accuracyPx = Math.max((gps.acc || 0) / 0.596, 10); // Min 10px for visibility
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, accuracyPx, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw marker on top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  // Redraw overlays when KMZ or GPS changes
  useEffect(() => {
    if (mapLoaded && tilesLoadedRef.current) {
      // Reload tiles to get clean base, then draw overlays
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Redraw tiles first (we should cache them, but for now reload)
      const { x, y } = latLonToTile(center.lat, center.lon, zoom);
      
      // Reload all tiles
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tileX = x + dx;
          const tileY = y + dy;
          const offsetX = (dx + 1) * tileSize;
          const offsetY = (dy + 1) * tileSize;
          
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, offsetX, offsetY, tileSize, tileSize);
            // Draw overlays after this tile loads
            if (dy === 1 && dx === 1) {
              setTimeout(drawOverlays, 100);
            }
          };
          img.src = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
        }
      }
    }
  }, [kmzData, gps, center.lat, center.lon, mapLoaded, zoom]);

  return (
    <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-100" style={{ width: '100%', height: '100%', minHeight: '256px' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[11px] border border-slate-300">
        {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
      </div>
      {kmzData && (
        <div className="absolute top-2 left-2 rounded bg-emerald-500/90 text-white px-2 py-1 text-[11px] font-medium">
          {kmzData.placemarks.length} field{kmzData.placemarks.length !== 1 ? 's' : ''}
        </div>
      )}
      {gps && (
        <div className="absolute top-2 right-2 rounded bg-red-500/90 text-white px-2 py-1 text-[11px] font-medium">
          GPS: ±{gps.acc}m
        </div>
      )}
    </div>
  );
}

// Helper functions for tile/pixel calculations
function latLonToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function latLonToPixel(lat: number, lon: number, z: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n * 256;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  return { x, y };
}
