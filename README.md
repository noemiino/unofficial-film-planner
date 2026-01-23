# IFFR Film Festival Planner

A visual timetable tool for managing your IFFR film festival schedule. Perfect for fellow film festival nerds who want to organize their screenings!

## About This Project

I built this tool out of my own need as a person with ADHD to visually see my film schedule in order to process it. I'm not really a developer — I'm a designer and a thinker of tools. Most of this was vibe coded, built iteratively following Gail's Law: start simple, add complexity incrementally. 

If you find it useful, great! If you want to improve it, even better. Feel free to fork, modify, and make it your own.

## Features

- 📅 5-day calendar view with navigation
- 🎬 Add films by parsing IFFR links (automatically extracts screenings)
- 🎨 Color-coded status: Moderating (yellow), Favorited (blue), Ticket (green)
- 📱 Responsive design for phone access
- 💾 Data storage (localStorage + Notion integration)
- 🔗 Share your schedule with others via short URLs
- ⭐ Favorites sidebar for unscheduled films
- 🔄 Switch between multiple screenings for the same film

## Quick Start

### Option 1: Use the Live Version (Easiest) ⭐

**For non-technical users:** Follow the easy step-by-step guide: **[📖 How to Start Using the Unofficial Film Planner](https://noe-mi.notion.site/How-to-Start-Using-the-Unofficial-Film-Planner-2f1513302a5581ecaf30fcc8fa64b135)**

**Quick version:**
1. **Open the app**: [https://unofficial-film-planner-production.up.railway.app](https://unofficial-film-planner-production.up.railway.app)
2. **Optional: Set up Notion sync** (see [SETUP_NOTION.md](./SETUP_NOTION.md) or the [Notion guide](https://noe-mi.notion.site/How-to-Start-Using-the-Unofficial-Film-Planner-2f1513302a5581ecaf30fcc8fa64b135))
3. Start adding films!

**That's it!** The app works in your browser, and you can access it from your phone too.

### Option 2: Just Use It Locally (No Server)

1. Clone this repo:
   ```bash
   git clone https://github.com/noemiino/unofficial-film-planner.git
   cd unofficial-film-planner
   ```

2. Open `index.html` in your browser
3. Start adding films! (Data saves in your browser)

**That's it!** No server needed for basic use.

### Option 3: Deploy Your Own Instance

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run locally to test:**
   ```bash
   npm start
   ```
   Open `http://localhost:3001` in your browser.

3. **Deploy for sharing** (see [DEPLOYMENT.md](./DEPLOYMENT.md)):
   - **Railway** (recommended - free, persistent storage)
   - **Vercel** (easiest - free, 2 minutes)
   - **Render** (free tier available)

4. **Optional: Set up Notion sync** (see [SETUP_NOTION.md](./SETUP_NOTION.md)):
   - Duplicate the [Notion template database](https://noe-mi.notion.site/2ed513302a5580fb8d4de0a4a594eeaa?v=6611426185744feb8cdd70c5c4d9719f) (recommended)
   - Create a Notion integration
   - Add your API key and Database ID in Settings

## Sharing Your Schedule

1. Deploy the server (see [DEPLOYMENT.md](./DEPLOYMENT.md))
2. Click "⚙️ Settings" → "🔗 Share Schedule"
3. Copy the link (automatically copied to clipboard!)
4. Share with others - they'll see your schedule in read-only mode
5. The link will always show an updated view of your schedule

## Notion Database Template

**For easy setup instructions, see:** **[📖 How to Start Using the Unofficial Film Planner](https://noe-mi.notion.site/How-to-Start-Using-the-Unofficial-Film-Planner-2f1513302a5581ecaf30fcc8fa64b135)**

**Quick reference:**
- **⭐ Recommended**: [Duplicate the Notion Template](https://noe-mi.notion.site/2ed513302a5580fb8d4de0a4a594eeaa?v=6611426185744feb8cdd70c5c4d9719f) - preserves all property types automatically
- **Alternative**: Create database manually (see [SETUP_NOTION.md](./SETUP_NOTION.md) for step-by-step instructions)
- **Technical details**: See [SETUP_NOTION.md](./SETUP_NOTION.md) for developers

**Important**: The app automatically detects property types and works with both Date/URL types AND Text types, but using the Notion template ensures everything is configured correctly from the start.

## Documentation

- **[📖 Easy Setup Guide (Notion)](https://noe-mi.notion.site/How-to-Start-Using-the-Unofficial-Film-Planner-2f1513302a5581ecaf30fcc8fa64b135)** - Step-by-step guide for non-technical users ⭐
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy the server, access from phone, share schedules
- **[SETUP_NOTION.md](./SETUP_NOTION.md)** - Technical details for Notion integration (optional)

## For Developers

- Built with vanilla JavaScript (no frameworks)
- Server uses Express.js
- Data stored in localStorage, Notion, or server file (for shares)
- Following "Gail's Law": Start simple, build complexity incrementally

## Contributing

This was built for my own needs, so I'm not sure if this will become a regularly maintained project. That said, I'm open to:
- 🐛 Bug reports
- 💡 Feature suggestions
- 🔧 Improvement ideas

Feel free to open an issue! I can't promise I'll address everything, but I'll do my best. And if you want to fork it and make it your own, go for it! 

I also cannot promise clean, production-ready code—this was vibe coded for my own needs, so expect some rough edges and unconventional patterns.

## Attribution & Support

If you find this useful or build something inspired by it, I'd appreciate:
- 💝 A mention of where the idea came from (Noémi Biró)
- ☕ [Buy me a coffee](https://buymeacoffee.com/noemibiro) if you'd like me to share similar small tools & ideas

This was built out of personal need, so any appreciation means a lot!

## License

MIT - Use it however you want! If you build something inspired by this, a mention would be nice ✨
