# Deployment Guide

Deploy the Film Festival Planner so it's always accessible and shareable. This covers everything: deploying the server, accessing from your phone, and sharing schedules.

## Why Deploy?

- ✅ Share your schedule with others (they get a permanent link)
- ✅ Access from your phone (works from anywhere)
- ✅ Sync with Notion across devices
- ✅ Always online (no need to keep your computer running)

## Quick Deploy Options

### Option 1: Railway (Recommended - Free Tier, Persistent Storage) ⭐

Best for sharing schedules because it has persistent file storage.

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub repository
4. Railway auto-detects Node.js and deploys
5. Copy the deployment URL (like `https://your-app.up.railway.app`)
6. In the app: ⚙️ Settings → Paste URL in "Backend Server URL" → Save & Sync

**Benefits:**
- ✅ Free tier ($5 credit/month)
- ✅ Persistent file storage (shared schedules work!)
- ✅ Auto-deploys from GitHub
- ✅ Always on

### Option 2: Vercel (Free & Easy, but Limited Storage)

Easy setup, but **shared schedules won't persist** (serverless = no file storage). Use this if you only need Notion sync, not sharing.

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```
   Follow the prompts (press Enter for defaults)

3. **Copy the URL** (like `https://your-app.vercel.app`)

4. **In the app:** ⚙️ Settings → Paste URL → Save & Sync

**Benefits:**
- ✅ Free tier
- ✅ Automatic HTTPS
- ✅ Auto-deploys from GitHub
- ⚠️ **Note:** Shared schedules won't persist (use Railway for sharing)

### Option 3: Render (Free Tier, Persistent Storage)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click "Create Web Service"
6. Copy the URL (like `https://your-app.onrender.com`)
7. In the app: ⚙️ Settings → Paste URL → Save & Sync

**Benefits:**
- ✅ Free tier available
- ✅ Persistent file storage
- ⚠️ **Note:** Free tier spins down after 15 min inactivity (wakes up in ~30 seconds)

## Accessing from Your Phone

Once deployed, accessing from your phone is easy:

1. **Open the app on your laptop** (the deployed URL or localhost)
2. **Copy the full URL** from your browser's address bar
3. **Send it to yourself** (email, message, etc.)
4. **Open it on your phone** - it works!

The app is responsive and works great on mobile browsers.

## Quick Testing: Cloudflare Tunnel (Temporary)

For quick testing without deploying, use a tunnel:

1. **Install Cloudflare Tunnel:**
   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. **Start your server:**
   ```bash
   npm start
   ```

3. **In a new terminal, create tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

4. **Copy the URL** (like `https://random-words-1234.trycloudflare.com`)

5. **In the app:** ⚙️ Settings → Paste tunnel URL → Save & Sync

**Note:** Tunnel URL changes each time. For permanent access, use a cloud deployment above.

## Local Development

Even after deploying, you can still run locally:

```bash
npm install
npm start
```

Then open `http://localhost:3001`

## Sharing Your Schedule

1. Make sure your server is deployed (Railway, Vercel, or Render)
2. In the app: ⚙️ Settings → "🔗 Share Schedule"
3. Copy the link (automatically copied to clipboard!)
4. Share with others - they'll see your schedule in read-only mode
5. The link updates automatically when you change your schedule

## Important Notes

- **shares.json**: Stores shared schedules. In `.gitignore` so each deployment has its own.
- **Notion API Keys**: Each user needs their own Notion integration and database
- **Data Storage**: Schedules stored in:
  - Browser localStorage (local)
  - Notion database (if configured)
  - Server's shares.json (for shared links)

## Troubleshooting

**"Sharing server not available" error:**
- Make sure your server is deployed and running
- Check that "Backend Server URL" in Settings matches your deployment URL
- Try accessing `https://your-deployment-url.com/api/share` directly (should show an error, not 404)

**CORS errors:**
- The server has CORS enabled, so this shouldn't happen
- Make sure you're accessing the app through the deployed URL, not `file://`

**Shared links not working:**
- Make sure the server is running (Railway/Vercel should always be)
- Check that shares.json exists on the server
- The shareId must exist in the server's storage

**Phone can't connect:**
- Make sure you're using the deployed URL, not localhost
- Check that the "Backend Server URL" in Settings is correct
- Try accessing the backend URL directly on your phone: `https://your-url.com/api/notion/test`
