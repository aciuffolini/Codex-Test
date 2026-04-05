/**
 * KMZ Uploader Component
 * Allows users to upload KMZ/KML files from Google Earth
 */

import React, { useRef, useState } from 'react';
import { KMZLoader, KMZData } from '../lib/map/KMZLoader';

interface KMZUploaderProps {
  onLoad: (data: KMZData) => void;
  className?: string;
}

export function KMZUploader({ onLoad, className = '' }: KMZUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isValidType = 
      file.name.endsWith('.kmz') ||
      file.name.endsWith('.kml') ||
      file.type === 'application/vnd.google-earth.kmz' ||
      file.type === 'application/vnd.google-earth.kml+xml';

    if (!isValidType) {
      setError('Please select a KMZ or KML file');
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await KMZLoader.loadKMZ(file);
      onLoad(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load KMZ file');
      console.error('KMZ load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFileName(null);
    setError(null);
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:shadow disabled:opacity-50 transition"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Loading...
            </>
          ) : (
            <>
              <span>📁</span>
              {fileName ? 'Change Farm Map' : 'Load Farm Map (KMZ)'}
            </>
          )}
        </button>

        {fileName && (
          <>
            <span className="text-xs text-slate-600">{fileName}</span>
            <button
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </div>
      )}

      {!error && fileName && (
        <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          ✓ Farm map loaded successfully
        </div>
      )}
    </div>
  );
}


