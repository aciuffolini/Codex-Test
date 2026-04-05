# Farm Visit App II

Multimodal agentic field-visit capture system with offline-first AI, RAG retrieval, and digital twin architecture.

## Try it

| Channel | Link |
|---------|------|
| Web App | [aciuffolini.github.io/Codex-Test](https://aciuffolini.github.io/Codex-Test/) |
| Android APK | [Download latest APK](https://github.com/aciuffolini/Codex-Test/actions/workflows/build-apk.yml) (Artifacts tab) |

Password: ask `aciuffolini@teknal.com.ar`

## Features

- GPS, camera, microphone capture with offline storage
- Local AI chat via Llama 3.2 3B (WebGPU, on-device)
- Cloud AI fallback (GPT-4o mini, Claude)
- RAG backend with hybrid structured + semantic retrieval (ChromaDB + SQLite)
- Whisper STT for voice-to-text transcription
- KMZ/KML farm map overlay
- Field visit form with auto-sync to RAG database
- Digital twin event-sourcing core
- Android APK via Capacitor (side-by-side install as `com.farmvisit.appii`)

## Architecture

```
next-version/
  gateway/          Python FastAPI backend (RAG engine, LLM proxy, CLIP embeddings)
  web-app/          React + Vite + Tailwind frontend (Capacitor for Android)
  shared/           TypeScript shared types and schemas
  vnext_twin_core/  Digital twin core (Python)
  contracts/        API and event contracts
```

## Run locally

**Terminal 1 — Gateway:**
```
cd next-version
python -m gateway.app
```

**Terminal 2 — Web app:**
```
cd next-version/web-app
npm install
npm run dev
```

Open http://localhost:5173/

## Build Android APK locally

```
cd next-version/web-app
npm run build:android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK at `android/app/build/outputs/apk/debug/app-debug.apk`

## Contact

For access and permissions: **aciuffolini@teknal.com.ar**
