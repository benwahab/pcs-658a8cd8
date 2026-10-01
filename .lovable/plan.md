# Audit: blank PCS preview in Chrome on desktop (read-only, no changes)

Nothing was modified, committed or deployed. This document only reports what was observed and the tests to run.

## Observed facts

1. **The app renders in a clean Chrome.** I loaded `http://localhost:8080/` in headless Chromium:
   - At 1280 px wide (desktop), the home page loads fully: header, "Espace professionnel", the hero text and the reports feed.
   - At 390 px wide (phone), the page renders the same way.
   - This points to the code currently being served, not to a general crash.
2. **Build:** the latest entry (2026-10-01 13:55) is "build OK". An earlier entry has leftover type errors, for example:
   - `MairieDashboard.tsx:21` and `OperationalLogin.tsx:180,185` refer to an `approval_status` column that the generated types do not have.
   - `admin.ts:34-65` calls RPCs that do not exist in the types.
   - `ReportDetail.tsx:18` uses a missing `description` field.

   These do not block the preview, but they show the frontend is out of sync with the backend. Those RPCs and columns may not exist on Supabase.
3. **Dev server:** it restarted at 13:55:55 ("`.env` changed, restarting server"). A Chrome tab opened during that restart may show a blank page until it is reloaded.
4. **Hydration error on desktop only:** "Hydration failed because the server rendered HTML didn't match the client…". React rebuilds the page on the client and it still shows up in the test. Likely sources in `src/pcs/App.tsx`:
   - `ConnectionStatus` (l.74-75 `navigator.onLine`, l.96-100 slow connection) shows a banner that the server never rendered.
   - `Shell` shows "Visiteur" or an email.
   - It is a weakness, but not proven to cause the blank page.
5. **Supabase 401:** `GET /rest/v1/public_report_media?...` returns 401 on desktop and phone alike. Report media fail to load, but the page does not go blank. The anon role probably lacks read access to that view; this is not confirmed.
6. **Service worker:** `public/sw.js` (cache `pcs-shell-v5`) is registered only when `import.meta.env.PROD` (`src/routes/__root.tsx:134`).
   - Navigations go network-first with a 3.5 s timeout and fall back to a cached `/index.html` (`sw.js:9-24`).
   - TanStack Start serves no real `/index.html`, so that fallback may hold an HTML shell pointing to old JS chunks that no longer exist after a redeploy. That gives a blank page with 404s on `/assets/*.js`.
   - This only affects an origin where a production build ran (published URL or a prod preview). It would explain "works on phone, blank on desktop Chrome", because the desktop Chrome kept an old worker or cache.
7. **Saved session and editor:** `src/integrations/supabase/previewAuthStorage.ts` passes the session through the editor only when the preview is framed. In a separate tab it uses `localStorage`. A corrupted or expired session stored only in desktop Chrome is possible but not observed.
8. **Splash screen:** `__root.tsx:118-123`: if the JS does not run, the inline script still removes `#pcs-splash` after 1.2 s, leaving a white page. That matches the symptom whenever the JS bundle fails to load (cache or old chunks).

## Not accessible

- Your Chrome's own logs (console, network, service workers, storage) are not visible to me. The captured preview logs are empty for runtime errors and console.
- I could not reproduce the exact Lovable preview host from this environment, only the local server.

## Most plausible cause (unconfirmed)

Stale state in desktop Chrome: an old service worker or cache serving outdated HTML and JS, or a tab opened during the server restart. The code itself renders correctly on desktop in a clean browser.

## Tests to run in desktop Chrome (non-destructive)

1. **Private window:** open the preview URL in an incognito window.
   - If PCS shows up, the cause is local state (worker, cache, storage). Go to test 2.
2. **DevTools > Application > Service workers:** with the preview open, look for an `sw.js` worker. Then check Cache Storage for `pcs-shell-v5`, and the Network tab for 404s on `/assets/*.js`. Note what you see before clearing anything.
   - Then tick "Bypass for network" and reload hard (Ctrl+Shift+R).
   - If the page comes back, the service worker or cache is confirmed.
3. **DevTools > Console** on the blank page: copy the first red error. For example "Failed to fetch dynamically imported module", "ChunkLoadError", "Hydration…" or an auth error. This is the decisive evidence for the right fix.

## Possible fixes after confirmation (not applied)

- Service worker: stop caching `/index.html` as a navigation fallback, bump the cache version, and add an unregister path.
- Hydration: render `ConnectionStatus` and the session area only after mounting.
- Add anon read access on `public_report_media` if the media should be public.
- Regenerate the Supabase types and fix the RPCs and columns that are missing from the generated types.
