# ByteBot — AI Chat App

A full-stack AI chat app: React + Vite frontend, Express + MongoDB backend,
Clerk for auth, ImageKit for uploads, Gemini for the model.

```
bytebot-2/
├── backend/   # Express API (Node, MongoDB, Clerk auth)
└── client/    # React + Vite frontend
```

## What was actually broken

The errors you were seeing —

```
Origin http://localhost:5173 is not allowed by Access-Control-Allow-Origin. Status code: 504
Fetch API cannot load https://bytebot-backend.vercel.app/api/userchats due to access control checks.
```

— weren't really a CORS bug. Your local frontend (`localhost:5173`) was
calling the **deployed** backend on Vercel (`bytebot-backend.vercel.app`)
instead of a backend running on your own machine. That deployed backend was
timing out (`504 Gateway Timeout`), and a timeout coming from the platform
itself never carries an `Access-Control-Allow-Origin` header — so the
browser reports it as a CORS failure even though the real problem is "the
server never answered." That's also why sending a message looked like it
"didn't send": starting a chat means a `POST /api/chats` call to that
backend, and it was failing before the AI ever got involved.

### Fixes applied

1. **`client/.env`** now points `VITE_API_URL` at `http://localhost:3000`
   (your local backend) for `npm run dev`. A separate **`client/.env.production`**
   overrides it to the deployed backend URL only when you run `npm run build`,
   so the right URL gets used automatically in each context — no more
   manually commenting/uncommenting a line.
2. **`backend/index.js`**:
   - CORS now reads a comma-separated list from `CLIENT_URL` and always also
     allows `http://localhost:5173` (plus the other ports Vite falls back to).
   - The MongoDB connection is cached properly using its real ready-state and
     an in-flight promise, instead of a boolean flag that could let several
     requests race to open the connection during a cold start.
   - Added `GET /api/health` so you can check the server and the DB
     connection independently of the frontend.
   - A blocked CORS origin now returns a clean `403` instead of bubbling into
     a generic crash.
3. **Responsive UI**: sidebar, chat thread, input bar, and dashboard now
   adapt at `1024px` / `768px` / `480px` breakpoints. On screens ≤768px the
   sidebar becomes a slide-out drawer behind a hamburger button instead of
   being squeezed into a sliver next to the chat.

## Running it locally

You need **two terminals** running at once — the frontend will not work
without the backend also running.

```bash
# Terminal 1
cd backend
npm install
npm run dev          # http://localhost:3000

# Terminal 2
cd client
npm install
npm run dev          # http://localhost:5173
```

Then open `http://localhost:5173`.

Sanity-check the backend on its own:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"mongoConnected":true}
```

If `mongoConnected` is `false`, the issue is MongoDB, not CORS — most often
your current IP isn't on the cluster's allow-list (MongoDB Atlas → Network
Access → Add your current IP, or `0.0.0.0/0` while developing).

### If you edit any `.env*` file

Vite only reads env files when its dev server **starts**. After changing
`client/.env` or `client/.env.production`, stop (`Ctrl+C`) and re-run
`npm run dev` / `npm run build` — saving the file alone won't apply it.

## Deploying to Vercel

This deploys as **two separate Vercel projects** — one for the API, one for
the frontend (a Node/Express + MongoDB backend isn't a static site, so it
needs its own serverless project).

### Backend

1. Push the repo to GitHub.
2. Vercel → **Add New Project** → import the repo → **Root Directory**: `backend`.
3. Framework preset **Other** — `backend/vercel.json` + `backend/api/index.js`
   are already set up as a serverless function.
4. Add the variables from `backend/.env.example` (with real values) in
   Vercel's Environment Variables settings. Set `CLIENT_URL` to your
   frontend's Vercel URL (you'll get this in the next step — you can come
   back and update it).
5. Deploy. Note the URL, e.g. `https://bytebot-backend.vercel.app`.

### Frontend

1. Vercel → **Add New Project** → import the same repo → **Root Directory**: `client`.
2. Framework preset **Vite** (auto-detected).
3. Add the variables from `client/.env.example` (with real values); set
   `VITE_API_URL` to the backend URL from above (no trailing slash). Vite
   picks this up via `.env.production` automatically at build time, but
   Vercel project env vars always take precedence, so set it there directly.
4. Deploy. Note the URL, e.g. `https://bytebot-frontend.vercel.app`.
5. Go back to the **backend** project's env vars, set `CLIENT_URL` to this
   frontend URL (comma-separate it with `localhost:5173` if you still want
   local dev to keep working against the deployed backend), then redeploy.

### Clerk

In the Clerk dashboard, add your deployed frontend URL to the allowed
origins / redirect URLs for sign-in and sign-up.

## A note on credentials

`backend/.env` and `client/.env` carry live keys (MongoDB connection
string, Clerk secret key, ImageKit private key, Gemini key). They weren't
found in your git history — your `.gitignore` already excludes `.env` in
both folders — so they don't look publicly leaked. Since they've now passed
through this chat, though, it's worth rotating the MongoDB password, the
Clerk secret key, and the ImageKit private key when convenient, and
continuing to keep `.env` out of git (the `.env.example` files are the ones
meant to be committed — they hold placeholders only).
