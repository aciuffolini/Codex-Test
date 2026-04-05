/**
 * Chat Drawer Component
 * Supports offline (Gemini Nano/Llama) and cloud (GPT-4o/Claude) models.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '@farm-visit/shared';
import { llmProvider } from '../lib/llm/LLMProvider';
import type { ModelOption, LLMInput, LLMProviderStats } from '../lib/llm/LLMProvider';
import { getUserApiKey, setUserApiKey } from '../lib/config/userKey';
import { useMicrophone } from '../hooks/useMicrophone';
import { localWhisper } from '../lib/agents/LocalWhisper';
import { twinCore, type TwinStatus } from '../lib/twin/TwinCore';

const MODEL_STORAGE_KEY = 'farm_visit_chat_model';

const MODEL_OPTIONS: Array<{
  value: ModelOption;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto (offline-first)',
    description: 'Prefers Gemini Nano or Llama on-device and falls back to cloud models when available.',
  },
  {
    value: 'nano',
    label: 'Gemini Nano (offline)',
    description: 'Runs entirely on-device (Android 14+ with AICore). No internet or API key needed.',
  },
  {
    value: 'llama-small',
    label: 'Llama Small (offline)',
    description: 'Offline fallback for Android 7+. Requires the local Llama model to be installed.',
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o mini (cloud)',
    description: 'Uses the cloud API via the proxy server. Requires internet + API key.',
  },
  {
    value: 'claude-code',
    label: 'Claude Code (cloud)',
    description: 'Anthropic via proxy. Requires an sk-ant-* API key and internet access.',
  },
];

type VisitContext = LLMInput['visitContext'];
type CurrentVisitContext = NonNullable<NonNullable<VisitContext>['current']>;

function loadStoredModel(): ModelOption {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem(MODEL_STORAGE_KEY) as ModelOption | null;
  return stored && MODEL_OPTIONS.some((opt) => opt.value === stored) ? stored : 'auto';
}

function persistModelSelection(value: ModelOption) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODEL_STORAGE_KEY, value);
}

function readVisitContext(): VisitContext {
  if (typeof window === 'undefined') return null;
  const raw = (window as any).__VISIT_CONTEXT__;
  if (!raw) return null;

  const sourceGps = raw.current?.gps || raw.gps;
  const currentGps = sourceGps
    ? {
        lat: sourceGps.lat,
        lon: sourceGps.lon,
        accuracy: sourceGps.acc ?? sourceGps.accuracy,
      }
    : undefined;

  const currentContext: Partial<CurrentVisitContext> = {};
  const currentNote = raw.current?.note ?? raw.note ?? null;
  const currentPhoto =
    raw.current?.photo ??
    raw.photo?.url ??
    (typeof raw.photo === 'string' ? raw.photo : null);
  const currentAudio =
    raw.current?.audio ??
    raw.audio?.url ??
    (typeof raw.audio === 'string' ? raw.audio : null);

  if (currentGps) currentContext.gps = currentGps;
  if (currentNote) currentContext.note = currentNote;
  if (currentPhoto) currentContext.photo = currentPhoto;
  if (currentAudio) currentContext.audio = currentAudio;

  const hasCurrent = Object.keys(currentContext).length > 0;

  const latest =
    (typeof raw.latest === 'object' && raw.latest !== null
      ? raw.latest
      : typeof raw.latestVisit === 'object' && raw.latestVisit !== null
      ? raw.latestVisit
      : null) || null;

  const allVisits = Array.isArray(raw.allVisits) ? raw.allVisits : [];

  return {
    current: hasCurrent ? (currentContext as CurrentVisitContext) : undefined,
    kmzData: raw.kmzData ?? raw.current?.kmzData ?? null,
    latest,
    allVisits,
  };
}

function formatTwinStatus(status: TwinStatus | null): string {
  if (!status) {
    return 'Twin: status unavailable';
  }

  const retrievalLabel = {
    idle: 'idle',
    searching: 'searching',
    ready: `${status.retrieval.resultCount} retrieved`,
    empty: 'no matches',
    'skipped-offline': 'offline/current only',
    error: 'error surfaced',
  }[status.retrieval.status];

  return `Twin: sync ${status.sync.pending} pending / ${status.sync.queued} queued · retrieval ${retrievalLabel}`;
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const { recording, startRecording, stopRecording, audioUrl, clearAudio } = useMicrophone();
  const [whisperProgress, setWhisperProgress] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(getUserApiKey());
  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => loadStoredModel());
  const [modelStats, setModelStats] = useState<LLMProviderStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [llamaProgress, setLlamaProgress] = useState<string>('');
  const llamaInitRef = useRef(false);
  const whisperInitRef = useRef(false);
  const [twinStatus, setTwinStatus] = useState<TwinStatus | null>(null);
  
  const initialMessage = useMemo(() => {
    const hasKey = getUserApiKey();
    return {
      role: 'assistant' as const,
      content: hasKey
        ? '👋 Hi! Select a model below (Auto, Nano, Llama, GPT-4o mini, Claude) and start chatting.'
        : '👋 Hi! Offline models (Auto/Nano/Llama) work without internet. Set an API key with the 🔑 button to unlock GPT-4o mini or Claude.',
    };
  }, []);
  
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  
  useEffect(() => {
    persistModelSelection(selectedModel);

    if (selectedModel === 'llama-small' || selectedModel === 'auto') {
      import('../lib/llm/LlamaLocal').then(({ llamaLocal }) => {
        if (llamaLocal.isReady()) {
          setLlamaProgress(`✅ ${llamaLocal.getActiveModel() || 'Llama'} loaded and ready`);
          return;
        }
        if (llamaInitRef.current || llamaLocal.isInitializing()) {
          return;
        }
        llamaInitRef.current = true;
        llamaLocal.initialize((progress) => {
          setLlamaProgress(progress.text);
        }).then(() => {
          setLlamaProgress(`✅ ${llamaLocal.getActiveModel()} loaded and ready`);
        }).catch((err) => {
          console.warn('[ChatDrawer] Llama init failed (expected on desktop):', err.message);
          setLlamaProgress('⚠️ Llama offline model unavailable — using cloud');
        }).finally(() => {
          llamaInitRef.current = false;
        });
      });
    } else {
      setLlamaProgress('');
    }

    if (selectedModel === 'llama-small' || selectedModel === 'auto' || selectedModel === 'nano') {
      if (localWhisper.isReady()) {
        setWhisperProgress('✅ Whisper STT loaded');
        return;
      }
      if (whisperInitRef.current) return;
      whisperInitRef.current = true;
      localWhisper.initialize((progress) => {
        setWhisperProgress(localWhisper.getProgress());
      }).then(() => {
        setWhisperProgress('✅ Whisper STT loaded');
      }).catch(err => {
        setWhisperProgress('❌ Whisper failed: ' + err.message);
      }).finally(() => {
        whisperInitRef.current = false;
      });
    } else {
      setWhisperProgress('');
    }
  }, [selectedModel]);

  const refreshModelStats = useCallback(async () => {
    setStatsError('');
    setStatsLoading(true);
    try {
      const stats = await llmProvider.getStats();
      setModelStats(stats);
    } catch (err: any) {
      setModelStats(null);
      setStatsError(err?.message || 'Unable to detect models');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const refreshTwinStatus = useCallback(async () => {
    try {
      setTwinStatus(await twinCore.getStatus());
    } catch (err) {
      console.warn('[ChatDrawer] Failed to load Twin status:', err);
      setTwinStatus(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const currentKey = getUserApiKey();
      setApiKey(currentKey);
      if (!currentKey && navigator.onLine) {
        setTimeout(() => setShowApiKeyInput(true), 1000);
      }
      refreshModelStats();
      refreshTwinStatus();
    }
  }, [open, refreshModelStats, refreshTwinStatus]);

  // Handle local STT transcription when recording finishes
  useEffect(() => {
    if (audioUrl && !recording) {
      const transcribeAudio = async () => {
        setBusy(true);
        try {
          if (localWhisper.isReady()) {
            setWhisperProgress('🎙️ Transcribing locally...');
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const text = await localWhisper.transcribe(blob);
            setInput(prev => prev ? `${prev} ${text.trim()}` : text.trim());
            setWhisperProgress('✅ Whisper STT loaded');
          } else {
            console.warn('Whisper not ready');
            setWhisperProgress('⚠️ Model not ready');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setWhisperProgress('❌ Transcription failed');
        } finally {
          clearAudio();
          setBusy(false);
        }
      };
      transcribeAudio();
    }
  }, [audioUrl, recording]);

  const handleApiKeySave = () => {
    setUserApiKey(apiKey);
    setShowApiKeyInput(false);
    if (apiKey) {
      setMessages((m) => [...m, { 
        role: 'assistant', 
        content: '✅ API key saved! You can now chat.' 
      }]);
    }
    refreshModelStats();
  };

  const send = async () => {
    if (!input.trim() || busy) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    const userInput = input.trim();
    setInput('');
    setBusy(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages((m) => [...m, assistantMsg]);

    try {
      const visitContext = readVisitContext();
      const location = visitContext?.current?.gps
        ? { lat: visitContext.current.gps.lat, lon: visitContext.current.gps.lon }
        : undefined;

      const generator = llmProvider.stream({
        text: userInput,
        location,
        model: selectedModel,
        visitContext,
      });

      let hasResponse = false;
      let twinStatusLoaded = false;
      for await (const chunk of generator) {
        hasResponse = true;
        if (!twinStatusLoaded) {
          setTwinStatus(llmProvider.getLastTwinStatus());
          twinStatusLoaded = true;
        }
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
      }

      setTwinStatus(llmProvider.getLastTwinStatus());
      if (!hasResponse) {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { 
              ...last, 
              content: 'No response generated. Check model availability (offline install or API key for cloud models).' 
            };
          }
          return copy;
        });
      }
    } catch (err: any) {
      console.error('[ChatDrawer] Error:', err);
      setTwinStatus(llmProvider.getLastTwinStatus());
      const errMsg = err.message || String(err);
      let errorMessage = `❌ Error: ${errMsg}\n\n`;
      
      if (errMsg.includes('API key')) {
        errorMessage += 'Set your API key using the 🔑 button above.';
      } else if (errMsg.includes('Gemini Nano')) {
        errorMessage += 'Gemini Nano runs only on Android 14+ with AICore. Switch to Auto or a cloud model (GPT-4o mini / Claude) if you do not have Nano.';
      } else if (errMsg.includes('Llama Local')) {
        errorMessage += 'Install the local Llama model or choose Auto/cloud.';
      } else if (errMsg.includes('No LLM available')) {
        errorMessage += 'No offline models detected and no API key configured. Install Gemini Nano / Llama or set your API key for cloud models.';
      } else if (errMsg.includes('server') || errMsg.includes('ECONNREFUSED')) {
        errorMessage += 'Start the test server locally (`node apps/web/test-server.js`) or point VITE_API_URL to your deployed API.';
      } else if (errMsg.includes('offline') || errMsg.includes('internet')) {
        errorMessage += 'Check your internet connection or switch to an offline model.';
      } else {
        errorMessage += 'Check the server console for details.';
      }
      
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: errorMessage };
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
          >
            <div className="border-b border-slate-200 p-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">AI Chat</h2>
              <div className="flex items-center gap-2">
                {showApiKeyInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API Key"
                      className="text-xs px-2 py-1 border rounded"
                    />
                    <button
                      onClick={handleApiKeySave}
                      className="text-xs px-2 py-1 bg-emerald-500 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowApiKeyInput(false)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowApiKeyInput(true)}
                    className="text-xs px-2 py-1 border rounded"
                    title="Set API Key"
                  >
                    🔑
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                  className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={refreshModelStats}
                  disabled={statsLoading}
                  className="text-xs px-2 py-1 border rounded hover:bg-slate-50 disabled:opacity-50"
                  title="Refresh model availability"
                >
                  ↻
                </button>
              </div>
              <div className="text-[11px] text-slate-500">
                {MODEL_OPTIONS.find((opt) => opt.value === selectedModel)?.description}
              </div>
              <div className="text-[11px] text-slate-500">
                {statsLoading
                  ? 'Checking model availability…'
                  : statsError
                  ? `⚠️ ${statsError}`
                  : modelStats
                  ? `Offline: ${modelStats.localAvailable ? '✅' : '⛔'} · Cloud: ${modelStats.cloudAvailable ? '✅' : '⛔'}`
                  : 'Model availability unknown'}
              </div>
              <div className="text-[11px] text-slate-500">
                {formatTwinStatus(twinStatus)}
              </div>
              {twinStatus?.retrieval.message && (
                <div className={`text-[11px] ${twinStatus.retrieval.status === 'error' ? 'text-amber-600' : 'text-slate-500'}`}>
                  {twinStatus.retrieval.message}
                </div>
              )}
              {llamaProgress && (
                <div className="text-[11px] text-emerald-600 font-medium">
                  {llamaProgress}
                </div>
              )}
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      m.role === 'user'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-3">
              <div className="flex flex-col gap-2">
                {whisperProgress && (
                  <div className="text-[10px] text-emerald-600 font-medium px-1">
                    {whisperProgress}
                  </div>
                )}
                {recording && (
                  <div className="text-xs text-rose-500 animate-pulse px-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    Recording your voice...
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (recording) {
                        setBusy(true);
                        try {
                          await stopRecording();
                          // The audioUrl state won't be immediately available here because React state is async
                          // We should ideally transcribe natively or use a ref, but for now we'll handle the actual transcription in a useEffect below
                        } catch (err) {
                          console.error(err);
                          setBusy(false);
                        }
                      } else {
                        startRecording();
                      }
                    }}
                    className={`rounded-xl border border-slate-300 p-2 lgpx-3 lgpy-2 text-sm transition-colors ${recording ? 'bg-rose-100 text-rose-600 border-rose-300' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                    disabled={busy || (whisperInitRef.current && !recording)}
                    title="Voice Input"
                  >
                    🎤
                  </button>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={busy}
                  />
                  <button
                    disabled={busy || !input.trim()}
                    onClick={send}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 text-slate-700"
                  >
                    {busy ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
