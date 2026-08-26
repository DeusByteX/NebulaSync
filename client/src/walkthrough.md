# NebulaSync Codebase Walkthrough

NebulaSync is a premium, real-time collaborative music web application inspired by the Spotify Web Player, allowing users to listen synchronously ("jam") with friends, manage queues, browse real-time tracks, and chat.

---

## 🛠️ Components and Code Implemented

### 1. Database & Authentication (Supabase + Local Failover)
- **[`supabaseClient.js`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/supabaseClient.js)**:
  - Initializes the official Supabase client config with URL and Anon key.
- **[`Login.jsx`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/components/Login.jsx)**:
  - **Passwordless Guest or Secured Real Account Selection**: Rewritten to accept optional passwords. 
    - *Guest Entry*: Leave the password field blank to instantly enter.
    - *Secure Account*: Enter a password (min 4 characters) to lock your handle.
  - **Automatic upgrades**: If a guest account later logs in with a password, the system automatically upgrades the profile to a secure account in the database.
  - **Persistent Local Cache & Auto-Login**: Authenticated sessions are written to the browser's `localStorage` cache. Upon refreshing the page or reopening the tab, the application immediately reads this cache, bypasses the login portal, and logs the user in automatically.
  - **Primary Supabase Flow**: Tries to search the Supabase `users_data` table for the handle. If it exists, it validates the password (if secured). If it doesn't, it automatically inserts the user (registering them) and logs them in.
  - **Local Failover Fallback**: If the Supabase query fails (e.g. because the table doesn't exist in your project yet), it seamlessly falls back to registering/logging the user in via the local server database [`server.js`](file:///c:/Users/KIIT/OneDrive/Documents/music app/server/server.js) `/api/auth/login-username` endpoint. The app remains 100% operational in both scenarios!

### 2. Backend Server
- **[`server.js`](file:///c:/Users/KIIT/OneDrive/Documents/music app/server/server.js)**:
  - Added the passwordless `/api/auth/login-username` auto-register endpoint to support local failover.
  - Spotify integration routes: `/api/spotify/setup`, `/api/music/search`, and `/api/music/resolve`.
  - Socket.io hooks coordinate active Jam rooms, synchronous playheads (play/pause/seek), queues, messages, and invites.

### 3. Frontend React Client
- **[`index.css`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/index.css)**:
  - Cyberpunk theme, radial nebula gradients, neon glows (`#00ffcc` cyan, `#ff007f` pink), and scanning lines.
- **[`App.jsx`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/App.jsx)**:
  - Manages active socket state, auto-joins via link URLs, upvote queue listeners, room locks, and floating emoji reaction states.
- **[`Dashboard.jsx`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/components/Dashboard.jsx)**:
  - Features copyable auto-join invite links, QR codes, upvoting loops, locked control locks, and emoji reaction widgets.
- **[`MusicPlayer.jsx`](file:///c:/Users/KIIT/OneDrive/Documents/music app/client/src/components/MusicPlayer.jsx)**:
  - Enforces playback authority locks (disables timeline seeks, play/pause, skips for listeners if Host control lock is active).

---

## 🧪 Verification and Testing

### 1. Build Compilation
Vite compiled the package successfully:
```bash
vite v8.2.2 building client environment for production...
✓ 1882 modules transformed.
dist/assets/index-Ck0rRgIn.css   28.34 kB
dist/assets/index-C6-ZaLwL.js   495.16 kB
✓ built in 513ms
```

### 2. Multi-client Simulation Scenario
1. Run `npm run dev` at the root folder to start the app.
2. Open http://localhost:5173/ and enter a username (e.g. `alex`) and select an avatar. Click **Enter Nebula Grid**. You are immediately logged in!
3. Open an Incognito window and register `taylor`. Taylor is logged in instantly.
4. Verify online activity updates, create a Jam room, send invitations, and watch the collaborative timelines synchronize!
5. **Supabase Database SQL Setup**: To enable persistent usernames across browsers in the cloud, navigate to your Supabase SQL Editor and run:
   ```sql
   create table if not exists public.users_data (
     username text primary key,
     avatar text,
     password text, -- Optional, used for secure accounts
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );

   alter table public.users_data enable row level security;
   create policy "Allow public read/write" on public.users_data for all using (true) with check (true);
   ```
