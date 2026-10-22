# Hosting EcoCity on Netlify (ready, not deployed)

The game is one self-contained web page, so any static host works. Everything for Netlify is in the repo; **nothing has been deployed**. Deploy only when the organisers say so.

## What gets published

`node scripts/build.js --site` (or `npm run build:site`) writes the `site/` folder:

| Path | What it is |
|---|---|
| `/` (`index.html`) | The game |
| `/leaderboard` (`leaderboard.html`) | Live public scores from the organisers' Google Sheet, refreshed every 30 seconds. No phone numbers. Good for a projector. |

`netlify.toml` tells Netlify to run that build and publish `site/`. It needs no packages. It also sets `Cache-Control: no-cache`, so a fix pushed on event day reaches every laptop when the page is reloaded.

## Before deploying: connect the Google Sheet

Results travel from every device to one Google Sheet (and from there to the leaderboard page and the in-game **Leaderboard** button).

1. Set up the sheet: see [tools/google-sheet/SETUP.md](../tools/google-sheet/SETUP.md). Use a **new** sheet, because v6 has different columns (team name + lead phone, three round scores).
2. Create `src/config.json` with the web app URL:
   ```json
   { "sheetUrl": "https://script.google.com/macros/s/XXXX/exec" }
   ```
   It is baked into both pages at build time, so every device uses it automatically.

Without `config.json` the game still works, but each device keeps results only on itself.

## Deploying (when told to)

Option A, connected to GitHub (updates on every push):
1. Netlify → **Add new site → Import an existing project → GitHub** → this repo.
2. Branch to deploy: the version you want live (for example `v6`).
3. Netlify reads `netlify.toml`; leave the build settings as they are. Press **Deploy**.

Option B, drag and drop (no account link to GitHub):
1. Run `npm run build:site` on a computer with Node 18 or newer.
2. Drag the `site` folder onto https://app.netlify.com/drop.

## Checks after deploying
- Open the site, start a game called *TEST*, and watch its row appear in the sheet's **Live** tab.
- Open `/leaderboard` on another device.
- Delete test rows in the sheet before the event.
