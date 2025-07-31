// Champion mapping utility functions

// Interface for champion data
export interface ChampionData {
  id: string;
  name: string;
  title: string;
  image: {
    full: string;
  };
}

// Cache for champion data to avoid repeated API calls
let championCache: { [key: string]: ChampionData } | null = null;

// Fetch champion data from Data Dragon API
export async function fetchChampionData(): Promise<{
  [key: string]: ChampionData;
}> {
  // Return cached data if available
  if (championCache) {
    return championCache;
  }

  try {
    const response = await fetch(
      "https://ddragon.leagueoflegends.com/cdn/14.15.1/data/en_US/champion.json"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch champion data");
    }

    const data = await response.json();

    // Convert champion data to mapping format
    const championMapping: { [key: string]: ChampionData } = {};

    Object.values(data.data).forEach((champion: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const champ = champion as any;
      championMapping[champ.key] = {
        id: champ.id,
        name: champ.name,
        title: champ.title,
        image: champ.image,
      };
    });

    // Cache the data
    championCache = championMapping;

    return championMapping;
  } catch (error) {
    console.error("Error fetching champion data:", error);
    return {};
  }
}

// Get champion name by ID
export async function getChampionName(championId: string): Promise<string> {
  const championData = await fetchChampionData();
  return championData[championId]?.name || `Champion ${championId}`;
}

// Get champion image URL by ID
export async function getChampionImageUrl(championId: string): Promise<string> {
  const championData = await fetchChampionData();
  const champion = championData[championId];

  if (champion) {
    return `https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/${champion.image.full}`;
  }

  // Return a placeholder image if champion not found
  return "https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/Aatrox.png";
}

// Get all champion data
export async function getAllChampions(): Promise<ChampionData[]> {
  const championData = await fetchChampionData();
  return Object.values(championData).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
