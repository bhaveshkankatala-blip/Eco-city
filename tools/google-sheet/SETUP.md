# Live Google Sheet for organisers (10 minutes, once)

Every laptop (and any phone or computer playing the hosted website) writes to one Google Sheet: a row appears when a team starts (**Playing**), it updates as they move through the levels, and it gets the final score and the three round scores (20% / 40% / 40%) when they finish. A **Leaderboard** tab sorts finished teams by SDG score (ties: years lasted). Only people you share the sheet with can see the sheet itself. The game's **Leaderboard** button (start screen) and `leaderboard.html` on the website show the finished scores to everyone, without phone numbers.

1. Sign in to the club's Google account and create a **new** Google Sheet (the v6 columns differ from earlier versions), e.g. *EcoCity Technozion 2026*.
2. **Extensions → Apps Script**. Delete what is there and paste everything from [`Code.gs`](Code.gs). Optional: change `KEY` (then tell Claude the new key so the game uses the same one).
3. Pick `setup` in the function list and press **Run**. Allow the permissions it asks for (it only touches this sheet). Two tabs appear: **Live** and **Leaderboard**.
4. **Deploy → New deployment → Select type: Web app**. Execute as: **Me**. Who has access: **Anyone**. Press **Deploy** and copy the **Web app URL** (ends in `/exec`).
5. Give that URL to Claude: it gets baked into the game (`src/config.json`), so all laptops have it automatically. (Or paste it on each laptop: Organiser → Game settings → Google Sheet link.)
6. Test: start a game named *TEST* on one laptop and watch a row appear within a few seconds. Delete test rows before the event.

**Rules the sheet enforces**
- Teams sign in with only a **team name** and the **team lead's phone number**.
- A team name already used with a **different** phone number is rejected; the team is asked to pick another name.
- The **same** team (same name + same phone) may play again; the row is marked *repeat* (replay policy still to be decided).
- If the Wi-Fi drops, each laptop keeps its updates and sends them, in order, when it reconnects (every 20 seconds). The organiser panel shows how many are waiting.

If you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
