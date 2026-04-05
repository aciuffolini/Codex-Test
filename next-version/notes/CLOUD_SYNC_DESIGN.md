# Cloud Sync Architecture Design: Dual-Store Model

## 1. Overview
The Farm Visit application operates fundamentally offline-first on mobile (Android/Capacitor) and online-first on Web. To reconcile this, we use a hybrid Dual-Store Sync Architecture.
1. **Edge Store (IndexedDB):** Handles rapid, offline-capable writes via Dexie.js for visits and captured media. 
2. **Cloud Store (SQLite + OS Filesystem via FastAPI):** Acts as the durable, canonical Event Sourcing backend (the "Twin") processing RAG operations and LLM multimodal reasoning.

## 2. One-Way Push Synchronization (Edge ➔ Cloud)
Currently, a One-Way Push model is implemented to prioritize the immediate preservation of field data captured by agronomists.
- **Workflow:** When an Android device regains connectivity, the synchronization engine reads un-synced events from local IndexedDB and pushes them to `POST /sync/events` and `POST /sync/media/upload`.
- **Media Optimization:** Base64 representations are skipped in favor of uploading physical Blob/Files through multipart-form data. URIs are managed through `local://` to server-relative static structures (`DATA_DIR/media/{visit_id}/...`).

## 3. Pull Mechanisms (Cloud ➔ Edge / Web)
- **Web App (Cloud Mode):** Operates on real-time canonical data by bypassing local IndexedDB logic entirely, routing all logic to `/api/visits`, `/api/chat`, and `/api/farms`.
- **Android App (Hybrid):** In upcoming iterations, it will perform incremental pulls upon synchronization initiation to load past global visits and updated Farm profiles (created on the web interface by Farm managers).

## 4. Platform Modes (`app.config.storage_mode`)
- **`cloud`:** Direct-to-Gateway. Read/Writes hit the FastAPI server synchronously. Default for modern Web clients.
- **`local`:** Local-Only. Events written locally via `api-simple.ts` to `vnext_twin_core` mock DB adapter logic.
- **`hybrid`:** Default for Android/Capacitor. Writes intercept to Local Dexie.js DB first. A background worker (via Capacitor Background Task APIs) monitors network status, flushing local mutations into the Cloud when `online`.

## 5. Offline-First RAG Retrieval 
While online, the Android Client executes multimodal Reasoning Requests against the FastAPI Gateway's `/api/chat`. Offline, the client degrades gracefully by relying on pre-synced rules and standard SQLite querying if an onboard-LLM isn't present, or natively integrated Gemini-Nano instances querying local IndexedDB records.
