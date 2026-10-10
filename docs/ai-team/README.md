# AI team workflow for EcoCity (event build, Oct 2026)

Three assistants, one game. Claude builds; Gemini and ChatGPT produce art and words that Claude puts into the game. You (the team) carry files between them.

| Assistant | Role | Prompt file | What it hands back |
|---|---|---|---|
| **Gemini Pro** | Art director + illustrator, then screenshot reviewer | `GEMINI_ART.md`, later `GEMINI_REVIEW.md` | 14 PNG illustrations; a short style guide; later, review notes |
| **ChatGPT Go** | Writer | `CHATGPT_CONTENT.md` | One JSON file with all in-game text (events, news, tutorial, SDG page, endings) |
| **Claude** | Builder and tester | (this repo) | The game, screenshots after each build |

## Order of work

1. **Today:** paste `GEMINI_ART.md` into Gemini (attach `docs/screenshots/start-screen-1080p.jpg` and `level1-1080p.jpg` as style references). Paste `CHATGPT_CONTENT.md` into ChatGPT. They can run in parallel.
2. **Download the 3D kits** listed in section "Files you need to download" and send the zips to Claude.
3. Send Claude: the PNGs from Gemini (keep the file names it was asked to use) and the JSON from ChatGPT (as a `.json` file).
4. Claude integrates and sends screenshots. Paste them into Gemini with `GEMINI_REVIEW.md`. Send its notes back to Claude.
5. Repeat step 4 two or three times before the playtest (~16 Oct).

## Rules that keep the output usable

- **Don't let either assistant invent game rules.** The numbers live in the game code. Event effects must use only the effect keys listed in `CHATGPT_CONTENT.md`.
- **Images: no text inside images** (Claude adds text in the game, so it stays sharp and translatable).
- **Keep file names exactly as asked.** Claude wires them by name.
- **Budget:** about 14 images in total. If Gemini runs out, ChatGPT can make the rest with the same style prompt.

## Files you need to download (free, CC0, from Kenney)

These are blocked from Claude's workspace. Download the ZIPs (click "Download", then "Continue without donating" if you like) and send them to Claude:

1. City Kit (Industrial) — https://kenney.nl/assets/city-kit-industrial
2. City Kit (Commercial) — https://kenney.nl/assets/city-kit-commercial
3. City Kit (Suburban) — https://kenney.nl/assets/city-kit-suburban
4. City Kit (Roads) — https://kenney.nl/assets/city-kit-roads

Optional ambient sound (any CC0 loop, e.g. from freesound.org, filter "Creative Commons 0"): one **birds / nature morning** loop and one **rain** loop, 30–90 s each, OGG or MP3.

Already in hand (fetched by Claude): Three.js r170, Kenney Nature Kit, Car Kit, Hexagon Kit, Interface Sounds, UI Audio, Impact Sounds.
