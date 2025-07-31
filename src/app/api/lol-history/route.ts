// Import necessary types from Next.js for handling API requests and responses
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

// Get the Riot API key from environment variables - this is the key you set in .env.local
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Define the base URLs for different Riot API endpoints
// Americas region is used for account and match endpoints (global)
const RIOT_API_BASE = "https://americas.api.riotgames.com";

// Helper function to format game duration in MM:SS format
const formatGameDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Helper function to calculate time ago in a human-readable format
const getTimeAgo = (timestamp: number) => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
};

// Helper function to get human-readable game mode name
const getGameModeName = (queueId: number, gameMode: string) => {
  // Queue ID mapping for common game modes
  const queueMap: { [key: number]: string } = {
    400: "Normal Draft",
    420: "Ranked Solo/Duo",
    430: "Normal Blind",
    440: "Ranked Flex",
    450: "ARAM",
    700: "Clash",
    900: "URF",
    1020: "One for All",
    1300: "Nexus Blitz",
    1400: "Ultimate Spellbook",
    1700: "Arena",
    1900: "URF",
    2000: "Tutorial 1",
    2010: "Tutorial 2",
    2020: "Tutorial 3",
  };

  // Return mapped name or fallback to gameMode
  return queueMap[queueId] || gameMode;
};

// Main handler for POST requests to this API route
export async function POST(req: NextRequest) {
  // Parse the JSON body from the request to get gameName and tagLine
  const { gameName, tagLine } = await req.json();

  // Validate that both gameName and tagLine are provided
  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: "Missing gameName or tagLine" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get PUUID from Riot ID (gameName + tagLine)
    // This endpoint converts the Riot ID to a PUUID which is needed for other API calls
    const accountRes = await fetch(
      `${RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!, // Include the API key in headers
        },
      }
    );

    // Check if the account was found
    if (!accountRes.ok) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Parse the account data to get the PUUID
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Step 2: Get match IDs for this PUUID (last 20 matches for load more functionality)
    // This endpoint returns a list of match IDs for the player
    const matchIdsRes = await fetch(
      `${RIOT_API_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    // Check if match IDs were successfully retrieved
    if (!matchIdsRes.ok) {
      return NextResponse.json(
        { error: "Could not fetch match IDs" },
        { status: 500 }
      );
    }

    // Parse the match IDs array
    const matchIds: string[] = await matchIdsRes.json();

    // Step 3: For each match ID, fetch detailed match information
    // Use Promise.all to fetch all matches concurrently for better performance
    const matchDetails = await Promise.all(
      matchIds.map(async (matchId) => {
        // Fetch detailed match data for each match ID
        const matchRes = await fetch(
          `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`,
          {
            headers: {
              "X-Riot-Token": RIOT_API_KEY!,
            },
          }
        );
        // If a match fails to load, return null (will be filtered out later)
        if (!matchRes.ok) return null;
        return await matchRes.json();
      })
    );

    // Step 4: Extract relevant information for each match
    // Filter out any null matches and process the data
    const matches = matchDetails
      .filter(Boolean) // Remove any null matches
      .map((match: any) => {
        // Find the participant data for the current player using their PUUID
        const participant = match.info.participants.find(
          (p: any) => p.puuid === puuid
        );

        // Helper function to determine role based on teamPosition (Riot's best guess)
        // teamPosition is more reliable than lane/role fields which are often incorrect
        const getRole = (participant: any) => {
          const teamPosition = participant.teamPosition;

          // teamPosition values are: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
          if (teamPosition === "TOP") return "top";
          if (teamPosition === "JUNGLE") return "jungle";
          if (teamPosition === "MIDDLE") return "mid";
          if (teamPosition === "BOTTOM") return "adc";
          if (teamPosition === "UTILITY") return "support";

          // Fallback to lane/role if teamPosition is missing (rare but possible)
          const lane = participant.lane;
          const role = participant.role;

          if (lane === "TOP") return "top";
          if (lane === "JUNGLE") return "jungle";
          if (lane === "MIDDLE") return "mid";
          if (lane === "BOTTOM" && role === "CARRY") return "adc";
          if (lane === "BOTTOM" && role === "SUPPORT") return "support";
          if (lane === "UTILITY") return "support";

          // Final fallback for edge cases
          return "unknown";
        };

        // Get all players from both teams and organize them by role
        const allPlayers = match.info.participants.map((p: any) => ({
          summonerName: p.riotIdGameName || p.summonerName,
          championName: p.championName,
          teamId: p.teamId, // 100 for blue side, 200 for red side
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          role: getRole(p),
          isCurrentPlayer: p.puuid === puuid,
          puuid: p.puuid, // Include PUUID for match details
        }));

        // Separate players by team
        const blueTeam = allPlayers.filter((p: any) => p.teamId === 100);
        const redTeam = allPlayers.filter((p: any) => p.teamId === 200);

        // Sort teams by role order: top, jungle, mid, adc, support
        const roleOrder = ["top", "jungle", "mid", "adc", "support"];
        const sortByRole = (a: any, b: any) => {
          return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
        };

        const sortedBlueTeam = blueTeam.sort(sortByRole);
        const sortedRedTeam = redTeam.sort(sortByRole);

        // Check if this was a remake (game duration < 3 minutes or specific game modes)
        const isRemake =
          match.info.gameDuration < 180 || // Less than 3 minutes
          match.info.gameMode === "PRACTICETOOL" ||
          match.info.gameType === "CUSTOM_GAME" ||
          match.info.gameMode === "TUTORIAL";

        // Get human-readable game mode name
        const gameModeName = getGameModeName(
          match.info.queueId,
          match.info.gameMode
        );

        // Return structured match data
        return {
          win: participant.win, // Boolean indicating if the player won
          champion: participant.championName, // Champion the player played
          blueTeam: sortedBlueTeam,
          redTeam: sortedRedTeam,
          gameMode: gameModeName, // Human-readable game mode name
          gameDuration: formatGameDuration(match.info.gameDuration), // MM:SS format
          gameDurationSeconds: match.info.gameDuration, // Raw seconds for calculations
          timeAgo: getTimeAgo(match.info.gameCreation), // Time since game ended
          isRemake: isRemake, // Flag to indicate if this was a remake
          matchId: match.metadata.matchId, // Include match ID for details
        };
      });

    // Return the processed matches data as JSON response
    return NextResponse.json({ matches });
  } catch (err) {
    // Handle any unexpected errors and return a generic error message
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
