import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FieldVisit } from './components/FieldVisit';
import { ChatDrawer } from './components/ChatDrawer';
import { PasswordPrompt } from './components/PasswordPrompt';
import { outbox } from './lib/outbox';

function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Cloud-only mode - no local models (Nano/Llama)
  // All AI features require API key and cloud connection

  // Check authentication on mount
  useEffect(() => {
    const authStatus = sessionStorage.getItem('app_authenticated');
    const authTime = sessionStorage.getItem('auth_timestamp');
    
    // Check if authenticated and session is still valid (24 hours)
    if (authStatus === 'true' && authTime) {
      const hoursSinceAuth = (Date.now() - parseInt(authTime)) / (1000 * 60 * 60);
      if (hoursSinceAuth < 24) {
        setAuthenticated(true);
        return;
      } else {
        // Session expired
        sessionStorage.removeItem('app_authenticated');
        sessionStorage.removeItem('auth_timestamp');
      }
    }
  }, []);

  // Auto-flush outbox when online
  useEffect(() => {
    if (navigator.onLine && authenticated) {
      outbox.flush();
    }
  }, [authenticated]);

  // Show password prompt if not authenticated
  if (!authenticated) {
    return <PasswordPrompt onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="mx-auto max-w-[920px] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-widest text-slate-500">Farm Visit</div>
            <div className="-mt-0.5 font-semibold text-slate-900">Field Capture</div>
          </div>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:shadow transition"
          >
            Chat
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-4 pb-12 pt-6">
        <FieldVisit />
      </main>

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default App;

