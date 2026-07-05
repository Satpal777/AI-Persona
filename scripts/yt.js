import { writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile();
} catch {
}

const API_KEY = process.env.YT_KEY;
const API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--max") args.max = Number(argv[++i]);
    else args._.push(a);
  }
  return args;
}

async function apiGet(path, params) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    const reason = body?.error?.message || res.statusText;
    throw new Error(`YouTube API error (${path}): ${reason}`);
  }
  return body;
}

// Accepts a full channel URL, a bare @handle, a channel ID (UC...), or a
// legacy /user/ username, and returns { channelId, uploadsPlaylistId, channel }.
async function resolveChannel(input) {
  let handle, channelId, username, searchQuery;

  const trimmed = input.trim();
  if (/^UC[\w-]{20,}$/.test(trimmed)) {
    channelId = trimmed;
  } else if (trimmed.startsWith("@")) {
    handle = trimmed;
  } else {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0]?.startsWith("@")) handle = parts[0];
      else if (parts[0] === "channel") channelId = parts[1];
      else if (parts[0] === "user") username = parts[1];
      else if (parts[0] === "c") searchQuery = parts[1];
      else searchQuery = parts[0];
    } catch {
      searchQuery = trimmed;
    }
  }

  let data;
  const part = "snippet,contentDetails,statistics";
  if (channelId) {
    data = await apiGet("channels", { part, id: channelId });
  } else if (handle) {
    data = await apiGet("channels", { part, forHandle: handle });
  } else if (username) {
    data = await apiGet("channels", { part, forUsername: username });
  }

  if (!data?.items?.length) {
    // Fallback: search by name/custom-URL slug and resolve the top hit.
    const query = searchQuery || handle || username || trimmed;
    const search = await apiGet("search", {
      part: "snippet",
      type: "channel",
      q: query,
      maxResults: 1,
    });
    const found = search.items?.[0]?.snippet?.channelId;
    if (!found) throw new Error(`Could not resolve a channel from: ${input}`);
    data = await apiGet("channels", { part, id: found });
  }

  const channel = data.items[0];
  return {
    channelId: channel.id,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
    channel: {
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      customUrl: channel.snippet.customUrl,
      publishedAt: channel.snippet.publishedAt,
      subscriberCount: channel.statistics.subscriberCount,
      videoCount: channel.statistics.videoCount,
      viewCount: channel.statistics.viewCount,
    },
  };
}

async function getAllVideoIds(uploadsPlaylistId, max) {
  const ids = [];
  let pageToken;
  do {
    const data = await apiGet("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: pageToken || "",
    });
    for (const item of data.items) ids.push(item.contentDetails.videoId);
    pageToken = data.nextPageToken;
    if (max && ids.length >= max) return ids.slice(0, max);
  } while (pageToken);
  return ids;
}

function isoDurationToSeconds(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

async function getVideoDetails(videoIds) {
  const videos = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const data = await apiGet("videos", {
      part: "snippet,contentDetails,statistics",
      id: chunk.join(","),
    });
    for (const v of data.items) {
      videos.push({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        tags: v.snippet.tags || [],
        categoryId: v.snippet.categoryId,
        thumbnail:
          v.snippet.thumbnails?.maxres?.url ||
          v.snippet.thumbnails?.high?.url ||
          v.snippet.thumbnails?.default?.url,
        duration: v.contentDetails.duration,
        durationSeconds: isoDurationToSeconds(v.contentDetails.duration),
        viewCount: Number(v.statistics.viewCount || 0),
        likeCount: Number(v.statistics.likeCount || 0),
        commentCount: Number(v.statistics.commentCount || 0),
        url: `https://www.youtube.com/watch?v=${v.id}`,
      });
    }
    console.log(`Fetched details for ${videos.length}/${videoIds.length} videos...`);
  }
  return videos;
}

async function main() {
  if (!API_KEY) {
    console.error(
      "Missing YOUTUBE_API_KEY. Add it to a .env file (see .env.example) or set it as an env var."
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const input = args._[0];
  if (!input) {
    console.error("Usage: node yt.js <channel-url-or-@handle> [--out file.json] [--max N]");
    process.exit(1);
  }

  console.log(`Resolving channel: ${input}`);
  const { channelId, uploadsPlaylistId, channel } = await resolveChannel(input);
  console.log(`Found channel: ${channel.title} (${channelId})`);

  console.log("Listing uploaded videos...");
  const videoIds = await getAllVideoIds(uploadsPlaylistId, args.max);
  console.log(`Found ${videoIds.length} videos. Fetching metadata...`);

  const videos = await getVideoDetails(videoIds);

  const output = {
    channel,
    fetchedAt: new Date().toISOString(),
    videoCount: videos.length,
    videos,
  };

  const outPath =
    args.out || path.join("data", "raw", `${channel.title.replace(/[^\w-]+/g, "_")}-videos.json`);
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved ${videos.length} videos to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
