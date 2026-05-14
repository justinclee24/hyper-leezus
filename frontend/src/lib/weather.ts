// Stadium coordinates for outdoor/open-air NFL and MLB venues.
// Domed and fully-retractable-roof stadiums are intentionally excluded —
// weather has no measurable effect on their games.

const OUTDOOR_NFL: Record<string, { lat: number; lon: number }> = {
  "Bears":      { lat: 41.862,  lon: -87.617  }, // Soldier Field, Chicago
  "Bengals":    { lat: 39.095,  lon: -84.516  }, // Paycor Stadium
  "Browns":     { lat: 41.506,  lon: -81.700  }, // Cleveland
  "Bills":      { lat: 42.774,  lon: -78.787  }, // Highmark Stadium
  "Broncos":    { lat: 39.744,  lon: -105.020 }, // Empower Field
  "Chiefs":     { lat: 39.049,  lon: -94.484  }, // Arrowhead
  "Giants":     { lat: 40.814,  lon: -74.074  }, // MetLife (open top)
  "Jets":       { lat: 40.814,  lon: -74.074  },
  "Eagles":     { lat: 39.901,  lon: -75.168  }, // Lincoln Financial
  "Packers":    { lat: 44.501,  lon: -88.062  }, // Lambeau
  "Ravens":     { lat: 39.278,  lon: -76.623  }, // M&T Bank
  "Steelers":   { lat: 40.447,  lon: -80.016  }, // Acrisure
  "Panthers":   { lat: 35.226,  lon: -80.853  }, // Bank of America
  "49ers":      { lat: 37.403,  lon: -121.970 }, // Levi's
  "Seahawks":   { lat: 47.595,  lon: -122.332 }, // Lumen Field
  "Titans":     { lat: 36.166,  lon: -86.771  }, // Nissan Stadium
  "Jaguars":    { lat: 30.324,  lon: -81.638  }, // EverBank
  "Commanders": { lat: 38.908,  lon: -76.864  }, // Northwest Stadium
  "Dolphins":   { lat: 25.958,  lon: -80.239  }, // Hard Rock (open sides)
};

const OUTDOOR_MLB: Record<string, { lat: number; lon: number }> = {
  "Cubs":        { lat: 41.948,  lon: -87.655  }, // Wrigley
  "Yankees":     { lat: 40.829,  lon: -73.926  }, // Yankee Stadium
  "Mets":        { lat: 40.757,  lon: -73.846  }, // Citi Field
  "Red Sox":     { lat: 42.347,  lon: -71.097  }, // Fenway
  "Cardinals":   { lat: 38.623,  lon: -90.193  }, // Busch Stadium
  "Pirates":     { lat: 40.447,  lon: -80.006  }, // PNC Park
  "Nationals":   { lat: 38.873,  lon: -77.008  }, // Nationals Park
  "Athletics":   { lat: 37.752,  lon: -122.201 }, // Oakland
  "Royals":      { lat: 39.051,  lon: -94.481  }, // Kauffman
  "Tigers":      { lat: 42.339,  lon: -83.048  }, // Comerica Park
  "Guardians":   { lat: 41.496,  lon: -81.685  }, // Progressive Field
  "Angels":      { lat: 33.800,  lon: -117.883 }, // Angel Stadium
  "Dodgers":     { lat: 34.074,  lon: -118.240 }, // Dodger Stadium
  "Padres":      { lat: 32.707,  lon: -117.157 }, // Petco Park
  "Giants":      { lat: 37.779,  lon: -122.389 }, // Oracle Park
  "Rockies":     { lat: 39.756,  lon: -104.994 }, // Coors Field
  "Phillies":    { lat: 39.906,  lon: -75.167  }, // Citizens Bank Park
  "Orioles":     { lat: 39.284,  lon: -76.622  }, // Camden Yards
  "White Sox":   { lat: 41.830,  lon: -87.634  }, // Guaranteed Rate Field
  "Reds":        { lat: 39.097,  lon: -84.507  }, // Great American Ball Park
  "Braves":      { lat: 33.891,  lon: -84.468  }, // Truist Park
};

const ALL_OUTDOOR = { ...OUTDOOR_NFL, ...OUTDOOR_MLB };

function findStadium(homeTeam: string): { lat: number; lon: number } | null {
  const lower = homeTeam.toLowerCase();
  for (const [key, coords] of Object.entries(ALL_OUTDOOR)) {
    if (lower.includes(key.toLowerCase())) return coords;
  }
  return null;
}

const _weatherCache = new Map<string, { data: WeatherData | null; expiry: number }>();
const WEATHER_TTL = 60 * 60 * 1000; // 1 hour

export interface WeatherData {
  windMph: number;
  precipChance: number; // 0–100
  tempF: number;
  description: string;
}

export async function fetchGameWeather(
  homeTeam: string,
  gameTime: string,
): Promise<WeatherData | null> {
  const apiKey = process.env.WEATHER_API_KEY ?? process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  const stadium = findStadium(homeTeam);
  if (!stadium) return null;

  const gameMs  = new Date(gameTime).getTime();
  const nowMs   = Date.now();
  const hoursAhead = (gameMs - nowMs) / (1000 * 60 * 60);
  if (hoursAhead < 0 || hoursAhead > 120) return null;

  // Cache key: lat/lon rounded to 2dp + game hour (so nearby stadiums & times share entries)
  const gameHour = Math.round(gameMs / (3600 * 1000));
  const cacheKey = `${stadium.lat.toFixed(2)},${stadium.lon.toFixed(2)},${gameHour}`;
  const hit = _weatherCache.get(cacheKey);
  if (hit && Date.now() < hit.expiry) return hit.data;

  try {
    // OpenWeatherMap 5-day/3-hour forecast — free tier, no subscription required
    const url =
      `https://api.openweathermap.org/data/2.5/forecast?` +
      new URLSearchParams({
        lat:   String(stadium.lat),
        lon:   String(stadium.lon),
        appid: apiKey,
        units: "imperial",
        cnt:   "40",
      });
    const resp = await fetch(url, { next: { revalidate: 3600 } });
    if (!resp.ok) {
      _weatherCache.set(cacheKey, { data: null, expiry: Date.now() + WEATHER_TTL });
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();

    // Find the 3-hour slot closest to game time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = data.list ?? [];
    const closest = list
      .map((h) => ({ h, delta: Math.abs(h.dt * 1000 - gameMs) }))
      .sort((a, b) => a.delta - b.delta)[0]?.h;

    const result: WeatherData | null = closest
      ? {
          windMph:      Math.round((closest.wind?.speed ?? 0) * 10) / 10,
          precipChance: Math.round((closest.pop ?? 0) * 100),
          tempF:        Math.round(closest.main?.temp ?? 70),
          description:  closest.weather?.[0]?.description ?? "",
        }
      : null;

    _weatherCache.set(cacheKey, { data: result, expiry: Date.now() + WEATHER_TTL });
    return result;
  } catch {
    _weatherCache.set(cacheKey, { data: null, expiry: Date.now() + WEATHER_TTL });
    return null;
  }
}
