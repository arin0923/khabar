# 🇳🇵 Khabar — Nepal News Aggregator

A clean, Apple News-style aggregator that pulls live RSS feeds from Nepal's top news sources into one beautiful page.

## Sources
- **The Kathmandu Post** — kathmandupost.com
- **OnlineKhabar** — english.onlinekhabar.com
- **Setopati** — setopati.com
- **Ratopati** — ratopati.com
- **BBC Nepal** — feeds.bbci.co.uk/nepali

## Features
- 📡 **Server-side RSS fetching** — no CORS issues, reliable & fast
- 🔄 **Auto-refresh** every 10 minutes
- 🗂️ **Category filters** — Politics, Business, Sports, Tech, Health, World, Entertainment
- 📰 **Source filters** — toggle individual outlets
- 🦸 **Hero layout** — top story featured prominently
- 🌐 **REST API** — `/api/news`, `/api/status`, `/api/refresh`

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18 or newer

### Run it

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
Double-click start.bat
```

**Or manually:**
```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/news` | GET | Fetch articles (optional: `?category=sports&source=ktmpost&limit=30`) |
| `/api/status` | GET | Server health + cache info |
| `/api/refresh` | POST | Trigger immediate RSS refresh |

### Example
```
GET /api/news?category=politics&limit=20
GET /api/news?source=bbcnepali
```

## Project Structure
```
khabar/
├── server.js          # Express backend + RSS fetcher + cache
├── public/
│   └── index.html     # Full frontend (served by Express)
├── package.json
├── start.sh           # Mac/Linux launcher
└── start.bat          # Windows launcher
```

## Deploy to the Web
To host Khabar online, you can deploy to:
- **Railway** — `railway up`
- **Render** — connect GitHub repo, set start command to `node server.js`
- **Fly.io** — `fly launch`
- **VPS** — run with `pm2 start server.js`

Set the `PORT` environment variable if needed (defaults to 3000).
