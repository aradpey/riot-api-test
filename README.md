# Riot API Player Information Website

A Next.js web application that displays League of Legends player information including match history, champion mastery, ranked statistics, and detailed match analytics.

## Features

- Search players by Riot ID (username#tagline)
- Display recent match history with win/loss, champions, teammates, and game details
- Show champion mastery levels and points
- Display ranked statistics and champion winrates
- View detailed match analytics including timeline, items, and performance metrics
- Browse all League of Legends champions
- Responsive design with interactive elements

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: CSS-in-JS (inline styles)
- **APIs**: Riot Games API, Data Dragon API
- **Deployment**: Vercel-ready

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd riot-api-app
```

2. Install dependencies
```bash
npm install
```

3. Create environment file
```bash
cp .env.local.example .env.local
```

4. Add your Riot API key to `.env.local`
```
RIOT_API_KEY=your_riot_api_key_here
```

5. Run the development server
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Getting a Riot API Key

1. Go to [Riot Developer Portal](https://developer.riotgames.com/)
2. Create an account and log in
3. Generate a development API key
4. Add the key to your `.env.local` file

## Usage

1. Enter a player's Riot ID (e.g., "pikachu#001") in the search form
2. View match history, champion mastery, and ranked statistics
3. Click on matches to see detailed analytics
4. Navigate to the Champions page to browse all League champions

## API Endpoints

- `/api/lol-history` - Fetch match history
- `/api/lol-player-stats` - Fetch player statistics and mastery
- `/api/lol-match-details` - Fetch detailed match analytics
