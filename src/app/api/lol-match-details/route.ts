// Import necessary types from Next.js for handling API requests and responses
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

// Get the Riot API key from environment variables
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Define the base URLs for different Riot API endpoints
const RIOT_API_BASE = "https://americas.api.riotgames.com";

// Main handler for POST requests to this API route
export async function POST(req: NextRequest) {
  // Parse the JSON body from the request to get matchId and puuid
  const { matchId, puuid } = await req.json();

  // Validate that both matchId and puuid are provided
  if (!matchId || !puuid) {
    return NextResponse.json(
      { error: "Missing matchId or puuid" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get detailed match information
    const matchRes = await fetch(
      `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    if (!matchRes.ok) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = await matchRes.json();

    // Step 2: Get match timeline
    const timelineRes = await fetch(
      `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}/timeline`,
      {
        headers: {
          "X-Riot-Token": RIOT_API_KEY!,
        },
      }
    );

    let timelineData = null;
    if (timelineRes.ok) {
      timelineData = await timelineRes.json();
    }

    // Step 3: Find the current player's data
    const currentPlayer = matchData.info.participants.find(
      (p: any) => p.puuid === puuid
    );

    if (!currentPlayer) {
      return NextResponse.json(
        { error: "Player not found in match" },
        { status: 404 }
      );
    }

    // Step 4: Extract detailed player statistics
    const playerStats = {
      // Basic stats
      kills: currentPlayer.kills,
      deaths: currentPlayer.deaths,
      assists: currentPlayer.assists,
      kda:
        currentPlayer.kills + currentPlayer.assists > 0
          ? (
              (currentPlayer.kills + currentPlayer.assists) /
              Math.max(currentPlayer.deaths, 1)
            ).toFixed(2)
          : "0.00",

      // Damage stats
      totalDamageDealtToChampions: currentPlayer.totalDamageDealtToChampions,
      physicalDamageDealtToChampions:
        currentPlayer.physicalDamageDealtToChampions,
      magicDamageDealtToChampions: currentPlayer.magicDamageDealtToChampions,
      trueDamageDealtToChampions: currentPlayer.trueDamageDealtToChampions,

      // Gold stats
      goldEarned: currentPlayer.goldEarned,
      goldSpent: currentPlayer.goldSpent,

      // Vision stats
      visionScore: currentPlayer.visionScore,
      wardsPlaced: currentPlayer.wardsPlaced,
      wardsKilled: currentPlayer.wardsKilled,

      // CS stats
      totalMinionsKilled: currentPlayer.totalMinionsKilled,
      neutralMinionsKilled: currentPlayer.neutralMinionsKilled,
      csPerMinute: (
        (currentPlayer.totalMinionsKilled +
          currentPlayer.neutralMinionsKilled) /
        (matchData.info.gameDuration / 60)
      ).toFixed(1),

      // Items
      items: [
        currentPlayer.item0,
        currentPlayer.item1,
        currentPlayer.item2,
        currentPlayer.item3,
        currentPlayer.item4,
        currentPlayer.item5,
        currentPlayer.item6,
      ].filter((item) => item !== 0), // Remove empty item slots

      // Summoner spells
      summoner1Id: currentPlayer.summoner1Id,
      summoner2Id: currentPlayer.summoner2Id,

      // Champion info
      championName: currentPlayer.championName,
      championLevel: currentPlayer.champLevel,
      championTransform: currentPlayer.championTransform, // For Kayn transformations

      // Position
      teamPosition: currentPlayer.teamPosition,
      individualPosition: currentPlayer.individualPosition,

      // Game info
      win: currentPlayer.win,
      gameDuration: matchData.info.gameDuration,
      gameMode: matchData.info.gameMode,
      queueId: matchData.info.queueId,
    };

    // Step 5: Extract timeline events for the current player
    let playerTimeline: any[] = [];
    if (timelineData) {
      const playerId = currentPlayer.participantId;

      // Get all events involving the current player
      playerTimeline = timelineData.info.frames.flatMap((frame: any) =>
        frame.events
          .filter(
            (event: any) =>
              event.participantId === playerId ||
              event.killerId === playerId ||
              event.victimId === playerId ||
              event.assistingParticipantIds?.includes(playerId)
          )
          .map((event: any) => ({
            ...event,
            timestamp: frame.timestamp,
            realTimestamp: event.realTimestamp || frame.timestamp,
          }))
      );
    }

    // Step 6: Extract team objectives
    const teamObjectives = matchData.info.teams.map((team: any) => ({
      teamId: team.teamId,
      win: team.win,
      objectives: {
        baron: team.objectives.baron,
        dragon: team.objectives.dragon,
        inhibitor: team.objectives.inhibitor,
        riftHerald: team.objectives.riftHerald,
        tower: team.objectives.tower,
      },
    }));

    // Return structured match details
    return NextResponse.json({
      playerStats,
      playerTimeline,
      teamObjectives,
      matchInfo: {
        gameCreation: matchData.info.gameCreation,
        gameDuration: matchData.info.gameDuration,
        gameMode: matchData.info.gameMode,
        queueId: matchData.info.queueId,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
