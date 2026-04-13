import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration for spotify-current-track function.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_CURRENT_TRACK_URL = "https://api.spotify.com/v1/me/player/currently-playing";

interface SpotifyTokenRow {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

interface SpotifyTrackResponse {
  item?: {
    id?: string;
    uri?: string;
    name?: string;
    album?: {
      name?: string;
      images?: Array<{ url?: string }>;
    };
    artists?: Array<{ name?: string }>;
  };
  timestamp?: number;
  is_playing?: boolean;
}

const buildBasicAuthHeader = (clientId: string, clientSecret: string) => {
  const credentials = `${clientId}:${clientSecret}`;
  return `Basic ${btoa(credentials)}`;
};

const refreshSpotifyToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string
) => {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": buildBasicAuthHeader(clientId, clientSecret)
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Spotify token refresh failed:", response.status, errorBody);
    throw new Error("Failed to refresh Spotify access token");
  }

  const data = await response.json();

  return {
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string | undefined) ?? refreshToken,
    expires_in: data.expires_in as number
  };
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const { user_id, recent_limit } = await req.json();

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid user_id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from<SpotifyTokenRow>("spotify_tokens")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", user_id)
      .single();

    if (tokenError) {
      console.error("Unable to load Spotify tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Spotify account not connected" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!tokenRow || !tokenRow.access_token) {
      return new Response(
        JSON.stringify({ error: "Spotify access token not available" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Spotify client credentials are missing in environment variables.");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let accessToken = tokenRow.access_token;
    let refreshToken = tokenRow.refresh_token;
    const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : null;
    const now = Date.now();

    // Refresh a minute before expiry so the app never experiences a 401 mid-set
    const isExpired = expiresAt ? expiresAt - 60_000 <= now : false;

    if (isExpired && refreshToken) {
      try {
        const refreshed = await refreshSpotifyToken(refreshToken, clientId, clientSecret);
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token;

        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        const { error: updateError } = await supabase
          .from("spotify_tokens")
          .update({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user_id);

        if (updateError) {
          console.error("Failed to update refreshed Spotify tokens:", updateError);
        }
      } catch (refreshError) {
        console.error("Spotify token refresh error:", refreshError);
        return new Response(
          JSON.stringify({ error: "Spotify token refresh failed" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    const fetchCurrentTrack = async (token: string) => {
      return await fetch(SPOTIFY_CURRENT_TRACK_URL, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    };

    let currentTrackResponse = await fetchCurrentTrack(accessToken);

    if (currentTrackResponse.status === 401 && refreshToken) {
      try {
        const refreshed = await refreshSpotifyToken(refreshToken, clientId, clientSecret);
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token;

        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        const { error: updateError } = await supabase
          .from("spotify_tokens")
          .update({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user_id);

        if (updateError) {
          console.error("Failed to update refreshed Spotify tokens after 401:", updateError);
        }

        currentTrackResponse = await fetchCurrentTrack(accessToken);
      } catch (refreshError) {
        console.error("Spotify token refresh error after 401:", refreshError);
        return new Response(
          JSON.stringify({ error: "Spotify token refresh failed" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    if (currentTrackResponse.status === 204) {
      return new Response(
        JSON.stringify({ track: null }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!currentTrackResponse.ok) {
      const errorBody = await currentTrackResponse.text();
      console.error("Failed to fetch Spotify current track:", currentTrackResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: "Unable to fetch current track from Spotify" }),
        {
          status: currentTrackResponse.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const trackJson = (await currentTrackResponse.json()) as SpotifyTrackResponse;
    const item = trackJson.item;

    if (!item) {
      return new Response(
        JSON.stringify({ track: null, recent_tracks: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const trackId = item.id ?? item.uri ?? null;
    const artistName = item.artists?.map((artist) => artist.name).filter(Boolean).join(", ") ?? null;
    const albumImageUrl = item.album?.images?.[0]?.url ?? null;

    const trackPayload = {
      track_name: item.name ?? null,
      artist_name: artistName,
      album_name: item.album?.name ?? null,
      album_image_url: albumImageUrl,
      track_id: trackId,
      played_at: trackJson.timestamp ? new Date(trackJson.timestamp).toISOString() : new Date().toISOString(),
      is_playing: trackJson.is_playing ?? false
    };

    const dedupeTracks = <T extends Record<string, unknown>>(tracks: T[]): T[] => {
      const seen = new Set<string>();

      return tracks.filter((track) => {
        const rawId = (track?.track_id ?? "") as string;
        const rawName = (track?.track_name ?? "") as string;
        const rawArtist = (track?.artist_name ?? "") as string;
        const key = rawId || `${rawName}::${rawArtist}`;

        if (!key) {
          return true;
        }

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    };

    const recentTracksLimit = typeof recent_limit === "number" && recent_limit > 0
      ? Math.min(Math.floor(recent_limit), 50)
      : 0;

    let recentTracks: Array<Record<string, unknown>> = [];

    if (recentTracksLimit > 0) {
      const recentResponse = await fetch(
        `https://api.spotify.com/v1/me/player/recently-played?limit=${recentTracksLimit}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        }
      );

      if (recentResponse.ok) {
        const recentJson = await recentResponse.json();
        const items = Array.isArray(recentJson?.items) ? recentJson.items : [];
        recentTracks = items.map((entry: any) => {
          const recentTrack = entry?.track ?? {};
          const recentArtists = Array.isArray(recentTrack?.artists)
            ? recentTrack.artists.map((artist: any) => artist?.name).filter(Boolean).join(", ")
            : null;

          return {
            track_name: recentTrack?.name ?? null,
            artist_name: recentArtists,
            album_name: recentTrack?.album?.name ?? null,
            album_image_url: recentTrack?.album?.images?.[0]?.url ?? null,
            track_id: recentTrack?.id ?? recentTrack?.uri ?? null,
            played_at: entry?.played_at ?? null,
            is_playing: entry?.is_playing ?? false
          };
        });
      } else {
        const recentErrorBody = await recentResponse.text();
        console.error("Failed to fetch Spotify recent tracks:", {
          status: recentResponse.status,
          body: recentErrorBody
        });
      }
    }

    const uniqueRecentTracks = dedupeTracks(recentTracks);
    const combinedTracks = dedupeTracks([
      trackPayload,
      ...uniqueRecentTracks
    ]);
    const [uniqueCurrentTrack, ...uniqueRecentTrackList] = combinedTracks;

    return new Response(
      JSON.stringify({
        track: uniqueCurrentTrack ?? null,
        recent_tracks: uniqueRecentTrackList
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Unexpected error in spotify-current-track function:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});

