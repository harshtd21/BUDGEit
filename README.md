# BUDGEit

A personal budgeting and expense tracker — plain HTML/CSS/JS, installed as a home-screen app on iPhone. All data stays on your device in IndexedDB; there is no backend, no analytics, and no third-party network calls.

## Local development

No build step and no server needed for basic editing — just double-click `index.html` to open it in a browser and test the UI. Note: the service worker (offline caching) only registers over HTTPS or `localhost`, so full offline behavior can only be verified once deployed (see below).

## Deploy to GitHub Pages (free HTTPS hosting)

1. Create a new **empty** repository on github.com (no README/license), e.g. `BUDGEit`.
2. From this folder, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/BUDGEit.git
   git push -u origin main
   ```
3. On GitHub: Settings → Pages → Source → Deploy from branch → `main` / `/ (root)`.
4. Wait a minute, then open `https://<your-username>.github.io/BUDGEit/` on your iPhone in Safari.
5. Tap the Share icon → **Add to Home Screen**. Launch the app from its new icon.
6. Test offline: turn on Airplane Mode and relaunch the app from the home screen — it should still work.

### Updating the app later

```
git add .
git commit -m "Update"
git push
```

GitHub Pages redeploys automatically. If changes don't show up on your phone, the service worker cache may be stale — bump `CACHE_NAME` in `sw.js` (e.g. `budget-pwa-v13`) before pushing so the new version is force-adopted.

## App icons

Custom icons are already generated in `icons/`. If you'd like to redesign them, open `tools/icon-generator.html` directly in a browser, adjust the drawing code, and use the download buttons to re-save the three PNGs into `icons/`.

## Backing up your data

Since all data is local to your phone, use **Profile → Export Data (JSON)** periodically to save a backup file (e.g. to the Files app or via AirDrop/email to yourself). **Profile → Import Data (JSON)** restores from a backup, replacing all current data.
