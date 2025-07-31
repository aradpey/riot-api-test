"use client";

// Import React hooks for state management
import React, { useState, useEffect } from "react";
// Import Next.js Link component
import Link from "next/link";
// Import champion mapping utilities
import { getChampionName, getChampionImageUrl } from "./utils/championMapping";

// Type definitions for better type safety
interface Player {
  summonerName: string;
  championName: string;
  teamId: number;
  kills: number;
  deaths: number;
  assists: number;
  role: string;
  isCurrentPlayer: boolean;
  puuid?: string;
}

interface Match {
  win: boolean;
  champion: string;
  blueTeam: Player[];
  redTeam: Player[];
  gameMode: string;
  gameDuration: string;
  gameDurationSeconds: number;
  timeAgo: string;
  isRemake: boolean;
  matchId: string;
}

interface PlayerStats {
  mastery: ChampionMastery[];
  ranked: RankedEntry[];
  winrates: ChampionWinrate[];
}

interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  championPointsSinceLastLevel: number;
  chestGranted: boolean;
  championName?: string; // Will be populated with actual champion name
}

interface RankedEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

interface ChampionWinrate {
  champion: string;
  wins: number;
  losses: number;
  winrate: string;
  totalGames: number;
  avgDamage: number;
  avgGold: number;
}

interface MatchDetails {
  playerStats: {
    kda: string;
    totalDamageDealtToChampions: number;
    goldEarned: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    visionScore: number;
    csPerMinute: string;
    items: number[];
  };
  playerTimeline: TimelineEvent[];
}

interface TimelineEvent {
  timestamp: number;
  type: string;
}

// Main page component for the League of Legends match history application
export default function Home() {
  // State for form inputs - gameName is the username part of Riot ID
  const [gameName, setGameName] = useState("");
  // State for tagline - the part after the # in Riot ID
  const [tagLine, setTagLine] = useState("");
  // Loading state to show spinner while fetching data
  const [loading, setLoading] = useState(false);
  // Error state to display any error messages
  const [error, setError] = useState<string | null>(null);
  // State to store the fetched match history data
  const [matches, setMatches] = useState<Match[]>([]);
  // State to track how many matches to display (for load more functionality)
  const [displayCount, setDisplayCount] = useState(10);
  // State for load more loading
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  // State for player statistics (mastery, winrates, ranked)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  // State for detailed match analytics
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  // State for champion data
  const [championData, setChampionData] = useState<{ [key: string]: string }>(
    {}
  );

  // Load champion data when component mounts
  useEffect(() => {
    const loadChampionData = async () => {
      try {
        // Fetch all champion data at once for better mapping
        const response = await fetch(
          "https://ddragon.leagueoflegends.com/cdn/14.15.1/data/en_US/champion.json"
        );

        if (response.ok) {
          const data = await response.json();
          const championNames: { [key: string]: string } = {};

          // Map champion keys to names
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.values(data.data).forEach((champion: any) => {
            championNames[champion.key] = champion.name;
          });

          setChampionData(championNames);
        }
      } catch (error) {
        console.error("Error loading champion data:", error);
      }
    };

    loadChampionData();
  }, []);

  // Handler for form submission - called when user clicks search button
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default form submission behavior
    e.preventDefault();
    // Set loading state to true to show loading indicator
    setLoading(true);
    // Clear any previous errors
    setError(null);
    // Clear any previous match data
    setMatches([]);

    try {
      // Send POST request to our API route with the gameName and tagLine
      const res = await fetch("/api/lol-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName, tagLine }),
      });

      // Parse the JSON response from our API
      const data = await res.json();

      // Handle errors from the API - check if response was not successful
      if (!res.ok) {
        setError(data.error || "Unknown error");
        setLoading(false);
        return;
      }

      // Set the matches in state if successful
      setMatches(data.matches);

      // Fetch player statistics (mastery, winrates, ranked)
      console.log("Sending player stats request with:", { gameName, tagLine });
      const statsRes = await fetch("/api/lol-player-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName, tagLine }),
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setPlayerStats(statsData);
      } else {
        console.log(
          "Player stats API error:",
          statsRes.status,
          statsRes.statusText
        );
        const errorData = await statsRes.json();
        console.log("Error details:", errorData);

        // Handle rate limit errors specifically
        if (statsRes.status === 429) {
          setError("Rate limit exceeded. Please wait a moment and try again.");
        }
      }
    } catch {
      // Handle network errors or other unexpected errors
      setError("Failed to fetch data");
    } finally {
      // Always set loading to false when done (whether success or error)
      setLoading(false);
    }
  };

  // Handler for load more button - shows additional matches
  const handleLoadMore = () => {
    setLoadMoreLoading(true);
    // Simulate loading delay for better UX
    setTimeout(() => {
      setDisplayCount((prev) => prev + 10);
      setLoadMoreLoading(false);
    }, 500);
  };

  // Handler for clicking on a match to show detailed analytics
  const handleMatchClick = async (match: Match) => {
    setSelectedMatch(match);
    setDetailsLoading(true);
    setShowMatchDetails(true);

    try {
      // Get PUUID from the first match (assuming same player)
      const puuid =
        match.blueTeam.find((p: Player) => p.isCurrentPlayer)?.puuid ||
        match.redTeam.find((p: Player) => p.isCurrentPlayer)?.puuid;

      if (!puuid) {
        setError("Could not identify player in match");
        return;
      }

      // Extract match ID from the match data
      const matchId = match.matchId;

      const res = await fetch("/api/lol-match-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, puuid }),
      });

      if (!res.ok) {
        setError("Failed to fetch match details");
        return;
      }

      const data = await res.json();
      setMatchDetails(data);
    } catch {
      setError("Failed to fetch match details");
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Navigation */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Link
          href="/"
          style={{
            marginRight: 16,
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: "bold",
          }}
        >
          Match History
        </Link>
        <Link
          href="/champions"
          style={{
            padding: "8px 16px",
            backgroundColor: "#28a745",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: "bold",
          }}
        >
          Champions
        </Link>
      </div>

      {/* Main title for the application */}
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: 32 }}>
        League of Legends Match History
      </h1>

      {/* Form for username and tagline input */}
      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: 32,
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}
          >
            Username (gameName):{" "}
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              required
              placeholder="e.g. pikachu"
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                marginTop: 4,
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}
          >
            Tagline (tagLine):{" "}
            <input
              type="text"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
              required
              placeholder="e.g. 001"
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                marginTop: 4,
              }}
            />
          </label>
        </div>

        {/* Submit button with loading state */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {loading ? "Loading..." : "Search Match History"}
        </button>
      </form>

      {/* Error message display */}
      {error && (
        <div
          style={{
            color: "red",
            backgroundColor: "#ffe6e6",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            border: "1px solid #ff9999",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Instructions for users */}
      {matches.length === 0 && !loading && !error && (
        <div
          style={{
            textAlign: "center",
            color: "#666",
            marginTop: 32,
            padding: 24,
            backgroundColor: "#f8f9fa",
            borderRadius: 8,
          }}
        >
          <p>
            Enter a League of Legends player&apos;s Riot ID to view their recent
            match history.
          </p>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Example: Username &quot;pikachu&quot; with Tagline &quot;001&quot;
            would be &quot;pikachu#001&quot;
          </p>
        </div>
      )}

      {/* Main content layout when data is loaded */}
      {matches.length > 0 && (
        <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
          {/* Left Section - Match History */}
          <div style={{ flex: 2 }}>
            <h2 style={{ color: "#333", marginBottom: 16 }}>
              Recent Matches ({matches.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {matches.slice(0, displayCount).map((match, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 16,
                    backgroundColor: match.isRemake
                      ? "#fff3e0"
                      : match.win
                      ? "#e8f5e8"
                      : "#ffe6e6",
                    color: "#000000",
                    cursor: "pointer",
                    transition: "transform 0.2s",
                  }}
                  onClick={() => handleMatchClick(match)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {/* Match result with color coding */}
                  <div
                    style={{
                      fontWeight: "bold",
                      fontSize: 18,
                      color: match.isRemake
                        ? "#ff8c00"
                        : match.win
                        ? "#28a745"
                        : "#dc3545",
                      marginBottom: 8,
                    }}
                  >
                    {match.isRemake
                      ? "🔄 REMAKE"
                      : match.win
                      ? "🏆 WIN"
                      : "❌ LOSS"}{" "}
                    - {match.gameMode} ({match.gameDuration})
                  </div>
                  {/* Time ago information */}
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      marginBottom: 8,
                    }}
                  >
                    {match.timeAgo}
                  </div>

                  {/* Teams display section */}
                  <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                    {/* Blue Team (Left Side) */}
                    <div style={{ flex: 1, color: "#000000" }}>
                      <h3
                        style={{
                          textAlign: "center",
                          marginBottom: 12,
                          color: "#0066cc",
                          fontWeight: "bold",
                        }}
                      >
                        Blue Team
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {match.blueTeam.map((player: Player, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              backgroundColor: player.isCurrentPlayer
                                ? "#ffffcc"
                                : "#f8f9fa",
                              borderRadius: 4,
                              border: player.isCurrentPlayer
                                ? "2px solid #ffcc00"
                                : "1px solid #ddd",
                              position: "relative",
                              overflow: "hidden",
                              minHeight: 60,
                            }}
                          >
                            {/* Champion background image - full container */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${player.championName.replace(
                                  /\s+/g,
                                  ""
                                )}_0.jpg)`,
                                backgroundSize: "cover",
                                backgroundPosition: "center 20%",
                                opacity: 0.3,
                                zIndex: 1,
                              }}
                            />

                            {/* Content overlay */}
                            <div
                              style={{
                                position: "relative",
                                zIndex: 2,
                                textAlign: "left",
                                paddingLeft: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: player.isCurrentPlayer
                                    ? "bold"
                                    : "normal",
                                  fontSize: player.isCurrentPlayer
                                    ? "16px"
                                    : "14px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    color: "#0066cc",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {player.role.toUpperCase()}
                                </span>
                                {" - "}
                                <span
                                  style={{ fontWeight: "bold", color: "#333" }}
                                >
                                  {player.summonerName}
                                </span>
                                {" - "}
                                <span style={{ color: "#333" }}>
                                  {player.championName}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#333",
                                  marginTop: 2,
                                }}
                              >
                                KDA: {player.kills}/{player.deaths}/
                                {player.assists}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Red Team (Right Side) */}
                    <div style={{ flex: 1, color: "#000000" }}>
                      <h3
                        style={{
                          textAlign: "center",
                          marginBottom: 12,
                          color: "#cc0000",
                          fontWeight: "bold",
                        }}
                      >
                        Red Team
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {match.redTeam.map((player: Player, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              backgroundColor: player.isCurrentPlayer
                                ? "#ffffcc"
                                : "#f8f9fa",
                              borderRadius: 4,
                              border: player.isCurrentPlayer
                                ? "2px solid #ffcc00"
                                : "1px solid #ddd",
                              position: "relative",
                              overflow: "hidden",
                              minHeight: 60,
                            }}
                          >
                            {/* Champion background image - full container */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${player.championName.replace(
                                  /\s+/g,
                                  ""
                                )}_0.jpg)`,
                                backgroundSize: "cover",
                                backgroundPosition: "center 20%",
                                opacity: 0.3,
                                zIndex: 1,
                              }}
                            />

                            {/* Content overlay */}
                            <div
                              style={{
                                position: "relative",
                                zIndex: 2,
                                textAlign: "right",
                                paddingRight: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: player.isCurrentPlayer
                                    ? "bold"
                                    : "normal",
                                  fontSize: player.isCurrentPlayer
                                    ? "16px"
                                    : "14px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  justifyContent: "flex-end",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#cc0000",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {player.role.toUpperCase()}
                                </span>
                                {" - "}
                                <span
                                  style={{ fontWeight: "bold", color: "#333" }}
                                >
                                  {player.summonerName}
                                </span>
                                {" - "}
                                <span style={{ color: "#333" }}>
                                  {player.championName}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#333",
                                  marginTop: 2,
                                }}
                              >
                                KDA: {player.kills}/{player.deaths}/
                                {player.assists}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more button */}
            {matches.length > displayCount && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadMoreLoading}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: loadMoreLoading ? "#ccc" : "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: loadMoreLoading ? "not-allowed" : "pointer",
                    fontSize: 16,
                  }}
                >
                  {loadMoreLoading
                    ? "Loading..."
                    : `Load More (${matches.length - displayCount} remaining)`}
                </button>
              </div>
            )}
          </div>

          {/* Middle Section - Player Stats */}
          <div style={{ flex: 1 }}>
            <h2 style={{ color: "#333", marginBottom: 16 }}>
              Player Statistics
            </h2>

            {/* Ranked Information */}
            {playerStats?.ranked && playerStats.ranked.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#333", marginBottom: 12 }}>
                  Current Rank
                </h3>
                {playerStats.ranked.map((rank: RankedEntry, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      backgroundColor: "#f8f9fa",
                      borderRadius: 8,
                      marginBottom: 8,
                      border: "1px solid #ddd",
                    }}
                  >
                    <div style={{ fontWeight: "bold", color: "#333" }}>
                      {rank.queueType === "RANKED_SOLO_5x5"
                        ? "Ranked Solo/Duo"
                        : "Ranked Flex"}
                    </div>
                    <div style={{ color: "#666" }}>
                      {rank.tier} {rank.rank} - {rank.leaguePoints} LP
                    </div>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      {rank.wins}W {rank.losses}L (
                      {((rank.wins / (rank.wins + rank.losses)) * 100).toFixed(
                        1
                      )}
                      % WR)
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Winrates */}
            {playerStats?.winrates && playerStats.winrates.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#333", marginBottom: 12 }}>
                  Ranked Solo/Duo Winrates
                </h3>
                <div>
                  {playerStats.winrates
                    .slice(0, 10)
                    .map((champ: ChampionWinrate, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: 8,
                          backgroundColor: "#f8f9fa",
                          borderRadius: 4,
                          marginBottom: 4,
                          border: "1px solid #ddd",
                          position: "relative",
                          overflow: "hidden",
                          minHeight: 60,
                        }}
                      >
                        {/* Champion background image - full container */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.champion.replace(
                              /\s+/g,
                              ""
                            )}_0.jpg)`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            opacity: 0.3,
                            zIndex: 1,
                          }}
                        />

                        {/* Content overlay */}
                        <div
                          style={{
                            position: "relative",
                            zIndex: 2,
                            textAlign: "left",
                            paddingLeft: 8,
                          }}
                        >
                          <div style={{ fontWeight: "bold", color: "#333" }}>
                            {champ.champion}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {champ.winrate}% WR ({champ.totalGames} games)
                          </div>
                          <div style={{ fontSize: "10px", color: "#888" }}>
                            Avg: {champ.avgDamage.toLocaleString()} dmg,{" "}
                            {champ.avgGold.toLocaleString()} gold
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Section - Champion Mastery */}
          <div style={{ flex: 1 }}>
            <h2 style={{ color: "#333", marginBottom: 16 }}>
              Champion Mastery
            </h2>

            {playerStats?.mastery && playerStats.mastery.length > 0 ? (
              <div>
                {playerStats.mastery
                  .slice(0, 15)
                  .map((champ: ChampionMastery, idx: number) => {
                    const championName =
                      championData[champ.championId.toString()] ||
                      `Champion ${champ.championId}`;
                    const championImageUrl = `https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/${championName.replace(
                      /\s+/g,
                      ""
                    )}.png`;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          backgroundColor: "#f8f9fa",
                          borderRadius: 8,
                          marginBottom: 8,
                          border: "1px solid #ddd",
                          position: "relative",
                          overflow: "hidden",
                          minHeight: 80,
                        }}
                      >
                        {/* Champion background image - full container */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${championName.replace(
                              /\s+/g,
                              ""
                            )}_0.jpg)`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            opacity: 0.3,
                            zIndex: 1,
                          }}
                        />

                        {/* Content overlay */}
                        <div
                          style={{
                            position: "relative",
                            zIndex: 2,
                            textAlign: "left",
                            paddingLeft: 8,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              color: "#333",
                              fontSize: 14,
                            }}
                          >
                            {championName}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            Level {champ.championLevel} -{" "}
                            {champ.championPoints.toLocaleString()} pts
                          </div>
                          <div style={{ fontSize: "10px", color: "#888" }}>
                            {champ.championPointsSinceLastLevel.toLocaleString()}{" "}
                            pts since last level
                          </div>
                          {champ.chestGranted && (
                            <div style={{ fontSize: "10px", color: "#28a745" }}>
                              ✓ Chest earned
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div style={{ color: "#666", textAlign: "center", padding: 20 }}>
                No mastery data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Match Analytics Modal */}
      {showMatchDetails && selectedMatch && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowMatchDetails(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 24,
              borderRadius: 8,
              maxWidth: 800,
              maxHeight: "80vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMatchDetails(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#666",
              }}
            >
              ×
            </button>

            <h2 style={{ marginBottom: 164, color: "#000" }}>
              Match Analytics
            </h2>

            {detailsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#000" }}>
                Loading detailed analytics...
              </div>
            ) : matchDetails ? (
              <div>
                {/* Player Stats */}
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ color: "#000" }}>Player Performance</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>KDA:</strong> {matchDetails.playerStats.kda}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>Damage:</strong>{" "}
                      {matchDetails.playerStats.totalDamageDealtToChampions.toLocaleString()}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>Gold:</strong>{" "}
                      {matchDetails.playerStats.goldEarned.toLocaleString()}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>CS:</strong>{" "}
                      {matchDetails.playerStats.totalMinionsKilled +
                        matchDetails.playerStats.neutralMinionsKilled}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>Vision Score:</strong>{" "}
                      {matchDetails.playerStats.visionScore}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: "#f8f9fa",
                        borderRadius: 4,
                        color: "#000",
                      }}
                    >
                      <strong>CS/min:</strong>{" "}
                      {matchDetails.playerStats.csPerMinute}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ color: "#000" }}>Items</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {matchDetails.playerStats.items.map(
                      (itemId: number, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: 8,
                            backgroundColor: "#f8f9fa",
                            borderRadius: 4,
                            border: "1px solid #ddd",
                            fontSize: "12px",
                            color: "#000",
                          }}
                        >
                          Item {itemId}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Timeline Events */}
                {matchDetails.playerTimeline &&
                  matchDetails.playerTimeline.length > 0 && (
                    <div>
                      <h3 style={{ color: "#000" }}>Timeline Events</h3>
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {matchDetails.playerTimeline
                          .slice(0, 20)
                          .map((event: TimelineEvent, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                padding: 4,
                                fontSize: "12px",
                                borderBottom: "1px solid #eee",
                                color: "#000",
                              }}
                            >
                              {Math.floor(event.timestamp / 60000)}:
                              {((event.timestamp % 60000) / 1000)
                                .toFixed(0)
                                .padStart(2, "0")}{" "}
                              - {event.type}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div style={{ color: "#000", textAlign: "center", padding: 40 }}>
                Failed to load match details
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
