# TeamSync: building a collaborative workspace that keeps working offline

A collaborative app should stay useful when the connection disappears. I built TeamSync as a shared document editor and project board with a Node.js WebSocket backend, Yjs CRDTs, durable server storage, and IndexedDB persistence in the browser.

## 1. Why a CRDT instead of “last save wins”?

A last-write-wins document endpoint can overwrite a teammate’s work when two devices save at the same time. Yjs represents edits as mergeable updates. Clients can apply updates in a different order, and duplicate delivery does not duplicate the underlying edit. When a device reconnects, it exchanges its saved CRDT state with the server rather than replacing the server document.

The text editor uses Y.Text. Input is converted into a minimal insertion/deletion range using a common-prefix and common-suffix diff. The board uses a Y.Map of task IDs containing nested Y.Maps, so a title change and a status change can merge independently. Simultaneous changes to the same field converge according to Yjs conflict resolution; this does not guarantee that both intended field values will survive.

## 2. Local first, network second

The browser loads its IndexedDB copy before connecting to the WebSocket server. Local updates write through y-indexeddb. A service worker caches the application shell and built assets for offline reopening after the first successful production load.

On connection, the server sends its full document state. The browser merges that state and uploads its local state. Further edits stream as incremental updates. Acknowledgements mark when an update has reached durable storage. The UI distinguishes connecting, saving, fully synced, and offline with a saved local copy. Retries use exponential backoff and jitter to reduce simultaneous reconnect spikes.

Offline support has a defined boundary: opened documents and boards are editable; workspace creation, invitations, member discovery, and new server-backed documents require a network connection. Browser storage can be cleared by the user or browser, so offline persistence is not a backup strategy.

## 3. Durable writes before acknowledgements

Each accepted update is validated and inserted into the database before the server acknowledges it. SQLite with WAL provides a convenient single-process development setup. PostgreSQL is the shared source of truth for multiple application instances. An in-memory Y.Doc is rebuilt from the durable update log when a room is first opened, so a process restart does not erase acknowledged changes.

Redis carries cross-instance notifications, not the authoritative data. A receiving instance loads missing database updates. A periodic durable reconciliation pass recovers from missed notifications. Per-room queues serialize updates inside one process. PostgreSQL sequence numbers establish a cursor for reconciliation across instances. Redis failure therefore increases synchronization latency rather than removing the durable record.

## 4. Horizontal scale is a topology, not a number

WebSocket connections belong to a document room. Each application instance loads only its active rooms, evicts idle rooms, applies payload limits, and disconnects slow consumers. Multiple instances can share PostgreSQL and Redis behind a WebSocket-capable load balancer. No sticky session is necessary for correctness when reconnects rebuild state from shared storage.

There are deliberate limits in this implementation: 200 loaded rooms per process, a 256 KiB encoded CRDT document ceiling, and 500 board tasks. Capacity depends on update frequency, document history, database latency, connection count, and hardware. A periodic transactional snapshot compacts active document logs at 100 updates; long-term retention and operational backups remain deployment concerns. This project demonstrates a scale-out architecture; it has not been benchmarked at large production traffic.

## 5. Collaboration still needs access control

HTTP sessions are stored server-side with only a hash of the bearer token in the database. Passwords use salted scrypt. Production cookies are HttpOnly, Secure, and SameSite=Strict. State-changing HTTP requests and WebSocket upgrades check the allowed Origin. Every document connection resolves workspace membership on the server; every incoming write checks membership again. Owners create editor/viewer invitation links, and viewers cannot send accepted updates.

The backend also limits authentication attempts, update size and update frequency. Heartbeats remove broken connections and expired sessions. Signing out revokes the current session and disconnects its WebSockets.

## 6. What I verified

Integration tests exercise two authenticated WebSocket clients, live text edits, concurrent disconnected CRDT edits merging without losing either inserted phrase, viewer write rejection, unauthorized workspace/API/WebSocket access, durable recovery after a server restart, invalid credentials, cross-origin request rejection, and logout revocation. A separate CRDT test checks independent task-field changes and duplicate/reordered updates; a snapshot-compaction test checks recovery after history reduction.

Production builds and JavaScript syntax checks pass. Browser behavior, real IndexedDB recovery, mobile layout, Redis/PostgreSQL multi-process behavior, and load capacity require their own validation before a production rollout. The repository includes a manual browser and scale-out checklist.

## References

- Yjs documentation: https://docs.yjs.dev/
- Offline editing: https://docs.yjs.dev/getting-started/allowing-offline-editing
- IndexedDB provider: https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb
- WebSocket scaling considerations: https://docs.yjs.dev/ecosystem/connection-provider/y-websocket

## LinkedIn draft

I built TeamSync for Nexlevr Level 3: a real-time collaborative workspace with shared documents, project boards, live presence, and offline editing.

The interesting challenge was reconnecting safely. Instead of replacing a document with the “latest save,” I used Yjs CRDT updates. IndexedDB keeps local edits, WebSockets carry live changes, and durable database writes happen before acknowledgements. A PostgreSQL + Redis deployment path lets application instances share document updates, while periodic database reconciliation covers missed notifications.

I also added workspace roles, server-side access checks, expiring invitation links, heartbeat/reconnect handling, and a responsive workspace UI.

My automated tests cover collaboration, concurrent offline-state merges, viewer permissions, access isolation, restart recovery, and logout revocation. Large-scale capacity still needs load testing, and browser offline behavior has a separate manual checklist.

The biggest lesson: offline support is a synchronization and recovery problem, not just a cached page.

#WebDevelopment #WebSockets #Yjs #OfflineFirst #JavaScript #Nexlevr #SoftwareEngineering
