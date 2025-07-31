"use client";

// Import React hooks for state management
import React, { useState, useEffect } from "react";
// Import Next.js Link component
import Link from "next/link";

// Interface for champion data
interface Champion {
  id: string;
  name: string;
  title: string;
  image: {
    full: string;
  };
}

// Main Champions page component
export default function ChampionsPage() {
  // State for storing champion data
  const [champions, setChampions] = useState<Champion[]>([]);
  // Loading state
  const [loading, setLoading] = useState(true);
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch champion data when component mounts
  useEffect(() => {
    const fetchChampions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch champion data from Data Dragon API
        const response = await fetch(
          "https://ddragon.leagueoflegends.com/cdn/14.15.1/data/en_US/champion.json"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch champion data");
        }

        const data = await response.json();

        // Convert champion data to array format
        const championsArray = Object.values(data.data).map(
          (champion: unknown) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: (champion as any).id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (champion as any).name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: (champion as any).title,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            image: (champion as any).image,
          })
        );

        // Sort champions alphabetically by name
        championsArray.sort((a, b) => a.name.localeCompare(b.name));

        setChampions(championsArray);
      } catch (err) {
        setError("Failed to load champions");
        console.error("Error fetching champions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChampions();
  }, []);

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

      {/* Page title */}
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: 32 }}>
        League of Legends Champions
      </h1>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 18, color: "#666" }}>
            Loading champions...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            color: "red",
            backgroundColor: "#ffe6e6",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            border: "1px solid #ff9999",
            textAlign: "center",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Champions grid */}
      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
            padding: 16,
          }}
        >
          {champions.map((champion) => (
            <div
              key={champion.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                minHeight: 120,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Champion background image */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champion.id}_0.jpg)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  opacity: 0.75,
                  zIndex: 1,
                }}
              />

              {/* Content overlay */}
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                  paddingBottom: 8,
                }}
              >
                {/* Champion name */}
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: 16,
                    color: "#fff",
                    marginBottom: 4,
                    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                  }}
                >
                  {champion.name}
                </div>

                {/* Champion title */}
                <div
                  style={{
                    fontSize: 12,
                    color: "#fff",
                    fontStyle: "italic",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {champion.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Champion count */}
      {!loading && !error && (
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            color: "#666",
            fontSize: 14,
          }}
        >
          Total Champions: {champions.length}
        </div>
      )}
    </main>
  );
}
