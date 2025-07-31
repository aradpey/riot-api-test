// Import necessary types from Next.js for handling API requests and responses
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

// Get the Riot API key from environment variables
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Helper function to handle rate limiting with retry logic
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      console.log(`Rate limited on attempt ${attempt}, waiting...`);
      // Wait longer between retries (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      continue;
    }

    return response;
  }

  // If all retries failed, return the last response
  return await fetch(url, options);
};

// Define the base URLs for different Riot API endpoints
const RIOT_API_BASE = "https://americas.api.riotgames.com";
const LOL_API_BASE = "https://na1.api.riotgames.com";

// Helper function to get human-readable game mode name
const getGameModeName = (queueId: number, gameMode: string) => {
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
    console.log("Searching for Riot ID:", gameName, tagLine);
    console.log("API Key exists:", !!RIOT_API_KEY);

    const accountUrl = `${RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
    console.log("Account URL:", accountUrl);

    const accountRes = await fetchWithRetry(accountUrl, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY!,
      },
    });

    console.log("Account API response status:", accountRes.status);
    console.log("Account API response status text:", accountRes.statusText);

    if (!accountRes.ok) {
      const errorText = await accountRes.text();
      console.log("Account API error response:", errorText);

      if (accountRes.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please wait a moment and try again.",
            details: `Status: ${accountRes.status}, Response: ${errorText}`,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Account not found",
          details: `Status: ${accountRes.status}, Response: ${errorText}`,
        },
        { status: 404 }
      );
    }

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Step 2: Get summoner data to get summonerId
    const summonerRes = await fetchWithRetry(
      `${LOL_API_BASE}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    if (!summonerRes.ok) {
      return NextResponse.json(
        { error: "Summoner not found" },
        { status: 404 }
      );
    }

    const summonerData = await summonerRes.json();
    const summonerId = summonerData.id;

    // Step 3: Get champion mastery data (top 10 only to reduce API load)
    console.log("Fetching mastery data for puuid:", puuid);
    const masteryRes = await fetchWithRetry(
      `${LOL_API_BASE}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=10`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    let masteryData = [];
    if (masteryRes.ok) {
      masteryData = await masteryRes.json();
      console.log(
        "Mastery data fetched successfully:",
        masteryData.length,
        "champions"
      );
    } else {
      console.log(
        "Mastery API error:",
        masteryRes.status,
        masteryRes.statusText
      );
      const masteryErrorText = await masteryRes.text();
      console.log("Mastery API error response:", masteryErrorText);

      // Don't fail the entire request if mastery data fails
      // Some players might not have mastery data
    }

    // Step 4: Get current season ranked data
    console.log("Fetching ranked data for summonerId:", summonerId);
    const rankedRes = await fetchWithRetry(
      `${LOL_API_BASE}/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    let rankedData = [];
    if (rankedRes.ok) {
      rankedData = await rankedRes.json();
      console.log(
        "Ranked data fetched successfully:",
        rankedData.length,
        "entries"
      );
    } else {
      console.log("Ranked API error:", rankedRes.status, rankedRes.statusText);
      const rankedErrorText = await rankedRes.text();
      console.log("Ranked API error response:", rankedErrorText);

      // Don't fail the entire request if ranked data fails
      // Some players might not have ranked data
    }

    // Step 5: Get match history for winrate calculation (Ranked Solo/Duo only, reduced count)
    console.log("Fetching match IDs for winrate calculation");
    const matchIdsRes = await fetchWithRetry(
      `${RIOT_API_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=50`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    let winrateData: {
      champion: string;
      wins: number;
      losses: number;
      winrate: string;
      totalGames: number;
      avgDamage: number;
      avgGold: number;
    }[] = [];
    if (matchIdsRes.ok) {
      const matchIds = await matchIdsRes.json();

      // Fetch detailed match data for winrate calculation (reduced to 10 to avoid rate limits)
      console.log(
        "Fetching detailed match data for",
        Math.min(matchIds.length, 10),
        "matches"
      );
      const matchDetails = await Promise.all(
        matchIds.slice(0, 10).map(async (matchId: string) => {
          const matchRes = await fetchWithRetry(
            `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`,
            {
              headers: {
                "X-Riot-Token": RIOT_API_KEY!,
              },
            }
          );
          if (!matchRes.ok) return null;
          return await matchRes.json();
        })
      );

      // Calculate winrates by champion
      const championStats: {
        [key: string]: {
          wins: number;
          losses: number;
          totalDamage: number;
          totalGold: number;
        };
      } = {};

      matchDetails.filter(Boolean).forEach((match: any) => {
        const participant = match.info.participants.find(
          (p: any) => p.puuid === puuid
        );
        if (participant) {
          const championName = participant.championName;
          if (!championStats[championName]) {
            championStats[championName] = {
              wins: 0,
              losses: 0,
              totalDamage: 0,
              totalGold: 0,
            };
          }

          if (participant.win) {
            championStats[championName].wins++;
          } else {
            championStats[championName].losses++;
          }

          championStats[championName].totalDamage +=
            participant.totalDamageDealtToChampions;
          championStats[championName].totalGold += participant.goldEarned;
        }
      });

      // Convert to winrate format
      winrateData = Object.entries(championStats)
        .map(([champion, stats]) => ({
          champion,
          wins: stats.wins,
          losses: stats.losses,
          winrate:
            stats.wins + stats.losses > 0
              ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
              : "0.0",
          totalGames: stats.wins + stats.losses,
          avgDamage: Math.round(
            stats.totalDamage / (stats.wins + stats.losses)
          ),
          avgGold: Math.round(stats.totalGold / (stats.wins + stats.losses)),
        }))
        .sort((a, b) => Number(b.winrate) - Number(a.winrate));
    } else {
      console.log(
        "Match IDs API error:",
        matchIdsRes.status,
        matchIdsRes.statusText
      );
    }

    // Return structured player data
    console.log("Returning player stats:", {
      masteryCount: masteryData.length,
      rankedCount: rankedData.length,
      winrateCount: winrateData.length,
    });

    return NextResponse.json({
      mastery: masteryData, // Already limited to top 10 by API call
      ranked: rankedData,
      winrates: winrateData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
