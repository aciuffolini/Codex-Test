import React, { useEffect, useState } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useCamera } from '../hooks/useCamera';
import { useMicrophone } from '../hooks/useMicrophone';
import { visitDB, VisitRecord } from '../lib/db';
import { saveVisit } from '../lib/api';
import { outbox } from '../lib/outbox';
import { getAIProcessingQueue } from '../lib/queues/AIProcessingQueue';
import { MediaStorage } from '../lib/storage/MediaStorage';
import { getSyncQueue } from '../lib/queues/SyncQueue';
import { Visit } from '@farm-visit/shared';
import { ConfirmFieldsModal } from './ConfirmFieldsModal';
import { FieldAgent } from '../lib/agents/FieldAgent';
import { agentMessaging } from '../lib/agents/AgentMessaging';
import { swarmTaskRouter } from '../lib/agents/SwarmTaskRouter';
import { FarmMap } from './FarmMap';
import { KMZUploader } from './KMZUploader';
import { KMZData } from '../lib/map/KMZLoader';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { SensorManager } from '../lib/sensors/SensorManager';
import type { SensorSource } from '../lib/sensors/ISensorProvider';

export function FieldVisit() {
  const { gps, error: gpsError, loading: gpsLoading, getGPS } = useGPS();
  const { photo, loading: photoLoading, capturePhoto, clearPhoto } = useCamera();
  const { recording, audioUrl, loading: audioLoading, startRecording, stopRecording, clearAudio } = useMicrophone();

  const [fields, setFields] = useState<Partial<Visit> | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [note, setNote] = useState('');
  const [kmzData, setKmzData] = useState<KMZData | null>(null);
  const [sensorSource, setSensorSource] = useState<SensorSource>('phone');

  // Initialize swarm agent system
  useEffect(() => {
    // Register Field Agent
    const fieldAgent = new FieldAgent();
    agentMessaging.registerAgent(fieldAgent);

    return () => {
      agentMessaging.unregisterAgent(fieldAgent.agentId);
    };
  }, []);

  // Expose structured visit context for AI chat and agents
  useEffect(() => {
    // Build structured visit context with all available data
    const visitContext = {
      gps: gps ? {
        lat: gps.lat,
        lon: gps.lon,
        acc: gps.acc,
        ts: gps.ts,
      } : null,
      note: note || null,
      photo: photo ? {
        present: true,
        url: photo, // dataURL for local access
      } : null,
      audio: audioUrl ? {
        present: true,
        url: audioUrl, // dataURL for local access
      } : null,
      // Include KMZ/KML farm map data (farm boundaries, field definitions)
      kmzData: kmzData ? {
        placemarks: kmzData.placemarks.map(p => ({
          name: p.name,
          type: p.type,
          coordinates: p.coordinates, // Array of {lat, lon, alt?}
        })),
        bounds: kmzData.bounds,
      } : null,
      // Include ALL saved visit records (full table history) for LLM access
      // IMPORTANT: Include photo_data and audio_data directly from database for LLM access
      allVisits: records.length > 0 ? records.map(record => ({
        id: record.id,
        field_id: record.field_id,
        crop: record.crop,
        issue: record.issue,
        severity: record.severity,
        note: record.note,
        ts: record.ts,
        lat: record.lat,
        lon: record.lon,
        acc: record.acc,
        // Pass photo_data directly (already in data URL format from database)
        photo_data: record.photo_data 
          ? (record.photo_data.startsWith('data:') 
              ? record.photo_data 
              : `data:image/jpeg;base64,${record.photo_data}`)
          : undefined,
        audio_data: record.audio_data || undefined,
      })) : [],
      // Also include latest visit for backward compatibility
      latestVisit: records.length > 0 ? {
        id: records[0].id,
        field_id: records[0].field_id,
        crop: records[0].crop,
        issue: records[0].issue,
        severity: records[0].severity,
        ts: records[0].ts,
        photo_data: records[0].photo_data 
          ? (records[0].photo_data.startsWith('data:') 
              ? records[0].photo_data 
              : `data:image/jpeg;base64,${records[0].photo_data}`)
          : undefined,
        audio_data: records[0].audio_data || undefined,
      } : null,
      ts: Date.now(),
    };
    (window as any).__VISIT_CONTEXT__ = visitContext;
    
    // Debug: Log visit context version
    if (records.length > 0) {
      console.log('[FieldVisit] Visit context updated - Total visits:', records.length);
      console.log('[FieldVisit] Latest visit ID:', records[0].id);
      console.log('[FieldVisit] Full visit history available:', records.length > 0);
    }
    
    // Broadcast context update to swarm
    agentMessaging.broadcast("visit_context_updated", visitContext);
  }, [gps, note, photo, audioUrl, records, kmzData]);

  // Load records on mount
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const list = await visitDB.list(20);
    setRecords(list);
  };

  const openConfirmModal = async () => {
    // Use swarm agent to extract/process fields
    try {
      const result = await swarmTaskRouter.route(
        "extract_fields",
        {
          note,
          gps,
          hasPhoto: !!photo,
        },
        {
          visit: { gps, note, hasPhoto: !!photo },
        }
      );

      const extractedFields = result.result as Partial<Visit>;
      
      const baseFields: Partial<Visit> = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        field_id: extractedFields.field_id || '',
        crop: extractedFields.crop || '',
        issue: extractedFields.issue || '',
        severity: extractedFields.severity,
        note: note || '',
        lat: gps?.lat,
        lon: gps?.lon,
        acc: gps?.acc,
        photo_present: !!photo,
        ...extractedFields,
      };
      setFields(baseFields);
      setAskOpen(true);
    } catch (err) {
      // Fallback to manual entry
      console.warn("Agent extraction failed, using defaults:", err);
      const baseFields: Partial<Visit> = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        field_id: '',
        crop: '',
        issue: '',
        severity: undefined,
        note: note || '',
        lat: gps?.lat,
        lon: gps?.lon,
        acc: gps?.acc,
        photo_present: !!photo,
      };
      setFields(baseFields);
      setAskOpen(true);
    }
  };

  const shareCSV = async () => {
    if (records.length === 0) {
      alert('No records to export');
      return;
    }

    const cols = [
      'id', 'ts', 'field_id', 'crop', 'issue', 'severity', 'note',
      'lat', 'lon', 'acc',
      'photo_present', 'audio_present',
      'photo_caption', 'audio_transcript', 'audio_summary',
      'syncStatus',
    ];
    const escape = (v: any) => v == null ? '' : ('"' + String(v).replace(/"/g, '""') + '"');

    const csv = [cols.join(',')]
      .concat(records.map(r => cols.map(c => escape((r as any)[c])).join(',')))
      .join('\n');

    const fileName = `farm_visits_${new Date().toISOString().split('T')[0]}.csv`;

    if (Capacitor.isNativePlatform()) {
      // Android: write to cache and use native share sheet (email, WhatsApp, etc.)
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Farm Visit Records',
          text: 'Attached are the latest offline field data records (CSV).',
          url: result.uri,
          dialogTitle: 'Share/Email Field Records',
        });
        return;
      } catch (err) {
        console.warn('[FieldVisit] Native share failed, falling back:', err);
      }
    }

    // Web: use Web Share API with File object if supported, otherwise download
    const blob = new Blob([csv], { type: 'text/csv' });

    if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'text/csv' })] })) {
      try {
        await navigator.share({
          title: 'Farm Visit Records',
          text: 'Attached are the latest offline field data records (CSV).',
          files: [new File([blob], fileName, { type: 'text/csv' })],
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('[FieldVisit] Web Share failed, falling back to download:', err);
      }
    }

    // Final fallback: browser download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleClearDB = async () => {
    if (!confirm(`Are you sure you want to clear all ${records.length} records?`)) {
      return;
    }
    
    try {
      await visitDB.clear();
      await loadRecords();
    } catch (err) {
      console.error('Clear DB error:', err);
      alert('Failed to clear database');
    }
  };

  const handleSave = async (editedFields: Partial<Visit>) => {
    setSaving(true);
    try {
      const visit: Visit = {
        id: editedFields.id!,
        ts: editedFields.ts!,
        field_id: editedFields.field_id,
        crop: editedFields.crop,
        issue: editedFields.issue,
        severity: editedFields.severity,
        note: editedFields.note,
        lat: editedFields.lat,
        lon: editedFields.lon,
        acc: editedFields.acc,
        photo_present: editedFields.photo_present || false,
      };

      // Save to local DB first (optimistic)
      // Use new media storage system (Blob/File instead of base64)
      const now = Date.now();
      const savedRecord: any = {
        ...visit,
        createdAt: now,
        updatedAt: now,
        photo_present: !!photo,
        audio_present: !!audioUrl,
        syncStatus: 'pending',
        task_type: 'field_visit',
        aiStatus: {
          captionDone: false,
          transcriptDone: false,
          embeddingDone: false,
        },
      };
      
      // Store media using MediaStorage (Blob on web, File on Android)
      if (photo) {
        try {
          savedRecord.photo = await MediaStorage.storePhoto(photo, visit.id);
          // Keep legacy photo_data for backward compatibility during migration
          savedRecord.photo_data = photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`;
        } catch (err) {
          console.warn('[FieldVisit] Failed to store photo:', err);
          // Fallback to base64
          savedRecord.photo_data = photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`;
        }
      }
      
      if (audioUrl) {
        try {
          savedRecord.audio = await MediaStorage.storeAudio(audioUrl, visit.id);
          // Keep legacy audio_data for backward compatibility
          savedRecord.audio_data = audioUrl.startsWith('data:') ? audioUrl : `data:audio/webm;base64,${audioUrl}`;
        } catch (err) {
          console.warn('[FieldVisit] Failed to store audio:', err);
          // Fallback to base64
          savedRecord.audio_data = audioUrl.startsWith('data:') ? audioUrl : `data:audio/webm;base64,${audioUrl}`;
        }
      }
      
      await visitDB.insert(savedRecord);
      
      // Log structured fields for verification
      console.log('[FieldVisit] Saved visit:', {
        id: savedRecord.id,
        field_id: savedRecord.field_id || '(empty)',
        crop: savedRecord.crop || '(empty)',
        issue: savedRecord.issue || '(empty)',
        severity: savedRecord.severity ?? '(empty)',
        photo: photo ? 'Yes' : 'No',
        audio: audioUrl ? 'Yes' : 'No',
      });
      
      // Queue AI processing (photo descriptions, audio transcriptions)
      // Works offline - will process when connectivity is restored
      try {
        // Get API key from env var (for .env file) or localStorage
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('user_api_key') || '';
        if (apiKey && (photo || audioUrl)) {
          const aiQueue = getAIProcessingQueue(apiKey);
          await aiQueue.queueProcessing(savedRecord, apiKey);
          console.log('[FieldVisit] Queued AI processing for offline/online completion');
        }
      } catch (err) {
        console.warn('[FieldVisit] Failed to queue AI processing:', err);
        // Non-critical, continue with save
      }

      // Queue for sync (new sync queue system)
      // This should trigger automatically when online
      try {
        const syncQueue = getSyncQueue();
        const serverUrl = import.meta.env.VITE_RAG_SERVER_URL || localStorage.getItem('rag_server_url') || 'http://localhost:8000';
        
        // Always set config (even if server not running, queue will retry)
        syncQueue.setConfig({
          serverUrl,
          apiKey: import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('user_api_key') || undefined,
        });
        
        // Queue the record for sync
        await syncQueue.queueRecord(visit.id);
        console.log('[FieldVisit] Queued record for sync:', visit.id);
        
        // Try to process immediately if online
        if (navigator.onLine) {
          syncQueue.processQueue().catch(err => {
            console.warn('[FieldVisit] Sync processing failed:', err);
          });
        }
      } catch (err) {
        console.warn('[FieldVisit] Failed to queue sync:', err);
        // Non-critical, continue
      }

      // Reload records (this will update latestVisit with saved photo_data)
      await loadRecords();
      setAskOpen(false);
      
      // IMPORTANT: Don't clear photo/audio immediately - they're needed for chat analysis
      // The photo is saved to database and will be available via latestVisit.photo_data
      // But keep current photo state visible for immediate chat access
      // Only clear if user explicitly starts a new capture
      
      // Clear note and fields to reset form
      setNote('');
      setFields(null);
      
      // Note: Photo and audio remain in state until next capture or explicit clear
      // This allows immediate chat analysis after saving
      console.log('[FieldVisit] Visit saved. Photo remains available for chat analysis.');
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save visit. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Capture Section - Original MVP Layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: Map (minimal - original MVP style) */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
            <div className="text-xs font-medium">Map</div>
            <KMZUploader 
              onLoad={(data) => {
                setKmzData(data);
              }}
              className="text-xs"
            />
          </div>
          <div className="h-64 relative bg-slate-100">
            {kmzData ? (
              <FarmMap gps={gps || undefined} kmzData={kmzData} />
            ) : (
              <PrototypeMap gps={gps || undefined} />
            )}
          </div>
        </div>
        
        {/* Right: Capture Controls - Original MVP structure */}
        <div className="rounded-2xl border border-slate-200 p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Capture</div>
            <button
              onClick={async () => {
                const next: SensorSource = sensorSource === 'phone' ? 'glasses' : 'phone';
                await SensorManager.getInstance().setSource(next);
                setSensorSource(next);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                sensorSource === 'glasses'
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                  : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
              title={sensorSource === 'phone' ? 'Using phone sensors. Tap to switch to glasses.' : 'Using glasses sensors. Tap to switch to phone.'}
            >
              {sensorSource === 'phone' ? '📱 Phone' : '🕶️ Glasses'}
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={getGPS}
              disabled={gpsLoading}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm hover:shadow disabled:opacity-50"
            >
              {gpsLoading ? 'Getting GPS...' : 'Get GPS'}
            </button>
            
            <button
              onClick={async () => {
                try {
                  if (recording) {
                    await stopRecording();
                  } else {
                    await startRecording();
                  }
                } catch (err: any) {
                  console.error('[FieldVisit] Recording error:', err);
                  // Error is already shown by useMicrophone hook
                }
              }}
              disabled={audioLoading}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm hover:shadow disabled:opacity-50"
            >
              {recording ? 'Stop Recording' : 'Record Voice'}
            </button>
            
            <button
              onClick={() => capturePhoto()}
              disabled={photoLoading}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm hover:shadow disabled:opacity-50"
            >
              {photoLoading ? 'Capturing...' : 'Take Photo'}
            </button>
          </div>

          {/* GPS Status */}
          <div className="text-xs text-slate-600 min-h-[1.25rem]">
            {gpsLoading && <span className="text-blue-600">Getting GPS...</span>}
            {!gpsLoading && gps && (
              <span className="text-green-600">
                ✅ GPS: {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)} (±{gps.acc.toFixed(0)}m)
              </span>
            )}
            {!gpsLoading && !gps && gpsError && (
              <span className="text-red-600">❌ {gpsError}</span>
            )}
            {!gpsLoading && !gps && !gpsError && (
              <span className="text-slate-400">📍 Click "Get GPS" to detect location</span>
            )}
          </div>

          {/* Voice Note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Transcribed note or type here…"
            className="w-full rounded-xl border border-slate-300 p-2 text-sm"
            rows={3}
          />
          
          {/* Audio Playback */}
          {audioUrl && (
            <div>
              <audio controls src={audioUrl} className="w-full h-8" />
            </div>
          )}

          {/* Photo Preview */}
          {photo && (
            <div className="flex items-center gap-3">
              <img src={photo} alt="capture" className="h-20 w-20 object-cover rounded-lg border" />
              <button
                onClick={clearPhoto}
                className="text-xs text-slate-500 underline"
              >
                Remove photo
              </button>
            </div>
          )}

          {/* Store structured record */}
          <div className="pt-2 border-t mt-2">
            <div className="text-sm font-medium mb-1">Store structured record</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={openConfirmModal}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium shadow-sm hover:shadow"
              >
                Save Visit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Recent Records ({records.length})</div>
          <div className="flex gap-2">
            <button
              onClick={shareCSV}
              className="rounded-xl flex items-center gap-1 border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm hover:shadow"
            >
              <span>📧</span> Share/Email CSV
            </button>
            <button
              onClick={handleClearDB}
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs shadow-sm hover:shadow"
            >
              Clear DB
            </button>
          </div>
        </div>
        <div className="overflow-auto max-h-64">
          <table className="text-xs w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Time</th>
                <th className="text-left p-2">Field</th>
                <th className="text-left p-2">Crop</th>
                <th className="text-left p-2">Issue</th>
                <th className="text-left p-2">Severity</th>
                <th className="text-left p-2">Synced</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">
                    No records yet
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2">{new Date(r.ts || Date.now()).toLocaleString()}</td>
                    <td className="p-2">{r.field_id || '-'}</td>
                    <td className="p-2">{r.crop || '-'}</td>
                    <td className="p-2">{r.issue || '-'}</td>
                    <td className="p-2">{r.severity ?? '-'}</td>
                    <td className="p-2">
                      {r.syncStatus === 'synced' ? '✅' : 
                       r.syncStatus === 'syncing' ? '🔄' : 
                       r.syncStatus === 'failed' ? '❌' : '⏳'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmFieldsModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        fields={fields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

// Minimal prototype map (original MVP style)
function PrototypeMap({ gps }: { gps?: { lat: number; lon: number; acc: number } | null }) {
  const z = 15;
  const center = gps || { lat: -34.603722, lon: -58.381592 };
  const { x, y } = latLonToTile(center.lat, center.lon, z);
  const tiles: Array<{ tx: number; ty: number }> = [];
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tiles.push({ tx: x + dx, ty: y + dy });
    }
  }
  
  const px = latLonToPixel(center.lat, center.lon, z);
  const originPx = { x: (x - 1) * 256, y: (y - 1) * 256 };
  const marker = { left: px.x - originPx.x, top: px.y - originPx.y };
  
  return (
    <div className="relative w-full h-full" style={{ width: 256 * 3, height: 256 * 3 }}>
      {tiles.map((t, i) => (
        <img
          key={i}
          alt="tile"
          src={`https://tile.openstreetmap.org/${z}/${t.tx}/${t.ty}.png`}
          className="absolute"
          style={{
            left: (t.tx - (x - 1)) * 256,
            top: (t.ty - (y - 1)) * 256,
            width: 256,
            height: 256,
          }}
        />
      ))}
      {gps && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: marker.left, top: marker.top }}
        >
          <div className="h-3 w-3 rounded-full bg-red-600 shadow ring-2 ring-white" />
        </div>
      )}
      <div className="absolute left-2 bottom-2 rounded bg-white/90 px-2 py-1 text-[11px] border">
        {center.lat.toFixed(5)}, {center.lon.toFixed(5)} z{z}
      </div>
    </div>
  );
}

function latLonToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const xtile = Math.floor(((lon + 180) / 360) * n);
  const ytile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: xtile, y: ytile };
}

function latLonToPixel(lat: number, lon: number, z: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n * 256;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  return { x, y };
}

