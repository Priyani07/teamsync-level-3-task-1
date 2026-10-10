# Verification and submission demo

## Automated (verified in the authoring environment)

`npm run check`, `npm test`, `npm run build`.

The integration test starts real HTTP/WebSocket servers, uses multiple accounts, and restarts the server against the same SQLite file. Offline merge tests simulate separately edited CRDT replicas; they do not simulate browser IndexedDB or service worker storage.

## Browser checklist (run before recording)

- Register two accounts in separate browser profiles. Create one workspace and share an editor invite.
- Create one document and one board. Confirm text and card changes arrive in both profiles.
- Confirm both presence avatars appear, then close one profile and confirm it disappears.
- Rename a space. Refresh to see its saved title.
- Open a production-build document and wait until it says all changes synced.
- Turn Wi-Fi/network off. Edit text, reload while offline, and confirm the shell and local text load.
- Edit the same document in another profile, then reconnect the offline profile. Verify both inserted phrases survive and both profiles converge.
- Repeat offline behavior with task title edits and moving cards.
- Invite a viewer: text input and task status editing should be unavailable. Server tests independently check rejection.
- Export document TXT and board JSON. Confirm their contents.
- Test navigation and dialog keyboard focus at mobile widths 390 px and desktop widths 1440 px; verify no overflow and readable labels.
- Sign out after sync, then try browser back/refresh. Confirm a sign-in screen and cleared account-local IndexedDB stores.

## Multi-instance checklist (not verified in the authoring environment)

- Start PostgreSQL and Redis. Run two Node processes on different ports, same DATABASE_URL and REDIS_URL; set correct APP_ORIGIN for both.
- Use a WebSocket-capable reverse proxy and the same HTTPS origin for both processes.
- Connect two users to different instances. Verify live updates in both directions.
- Interrupt Redis after startup. Verify durable database reconciliation recovers updates (slower than normal). Restart Redis and check reconnect.
- Restart either process and reconnect. Confirm acknowledged changes remain.
- Load test representative room counts, concurrent connections and edits per second; record p95 acknowledgement latency, memory, CPU and database load.
- Review document history growth before sustained traffic. Verify snapshot compaction at 100 updates and configure retention/backups before large workloads.

## Suggested 3–4 minute demo

1. Dashboard + create shared document (30 sec).
2. Invite a second account + live typing + presence (60 sec).
3. Offline edit + reconnect merge (60 sec).
4. Board drag/drop + viewer permission + export (45 sec).
5. Show tests and architecture/design-decisions post (30 sec).

Do not claim a measured concurrency/throughput number without load-test evidence. Publish the technical/LinkedIn draft manually after reviewing it and adding your repository/demo link.
