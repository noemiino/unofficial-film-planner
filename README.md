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

### Option 1: Just Use It Locally (Simplest)

1. Clone this repo:
   ```bash
   git clone https://github.com/yourusername/film-festival-tool.git
   cd film-festival-tool
   ```

2. Open `index.html` in your browser
3. Start adding films! (Data saves in your browser)

**That's it!** No server needed for basic use.

### Option 2: Full Setup (With Sharing & Phone Access)

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

4. **Optional: Set up Notion sync** (see [SETUP.md](./SETUP.md)):
   - Create a Notion integration
   - Create a database
   - Add your API key in Settings

## Sharing Your Schedule

1. Deploy the server (see [DEPLOYMENT.md](./DEPLOYMENT.md))
2. Click "⚙️ Settings" → "🔗 Share Schedule"
3. Copy the link (automatically copied to clipboard!)
4. Share with others - they'll see your schedule in read-only mode
5. The link will always show an updated view of your schedule

## Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy the server, access from phone, share schedules
- **[SETUP.md](./SETUP.md)** - Set up Notion integration (optional)

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
