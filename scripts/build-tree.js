import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile();
} catch {
}

const API_KEY = process.env.YT_KEY || process.env.YOUTUBE_API_KEY;
const API_BASE = "https://www.googleapis.com/youtube/v3";

const CATEGORIES = [
  { name: "DSA", re: /\bdsa\b|data structures?|\balgorithms?\b|recursion|leetcode/i },
  { name: "AI & Data Science", re: /\bai\b|machine learning|\bml\b|data science|numpy|pandas|jupyter|artificial intelligence/i },
  { name: "Python", re: /\bpython\b|django|flask|funpy/i },
  { name: "TypeScript", re: /typescript|\bts\b/i },
  { name: "Mobile Development", re: /flutter|android|ios|kotlin|swift|react native|\bmobile\b|spritekit|cocoapods/i },
  { name: "React & Frontend", re: /\breact\b|next\.?js|nextjs|\bvue\b|angular|nuxt|svelte|redux|zustand/i },
  { name: "JavaScript", re: /javascript|\bjs\b/i },
  { name: "HTML & CSS", re: /\bhtml\b|\bcss\b|tailwind|\bsass\b|bootstrap|flexbox|materialize/i },
  { name: "Backend & APIs", re: /\bnode\b|express|backend|\bapi\b|graphql|fastify|prisma|spring ?boot|\.net/i },
  { name: "Databases", re: /mongodb|\bmongo\b|\bsql\b|postgres|\bredis\b|database|aggregation pipeline/i },
  { name: "Security & Networking", re: /pentest|hacking|cryptography|metasploit|\bkali\b|network simulator|\bns3\b|backtrack/i },
  { name: "DevOps & Cloud", re: /docker|\baws\b|\bcloud\b|devops|\blinux\b|kubernetes|\bdeploy/i },
  { name: "Golang", re: /golang|go ?lang/i },
  { name: "Git & GitHub", re: /\bgit\b|github/i },
  { name: "System Design", re: /system design/i },
  { name: "Design & UI", re: /adobe xd|sketch|figma|\bxd\b|ui\/?ux/i },
  { name: "Interview & Career", re: /interview|career|\bresume\b/i },
  { name: "C, C++ & Java", re: /c\+\+|\bjava\b/i },
  { name: "Vlogs, Podcasts & Personal", re: /podcast|\bvlog|travel|thought vlog|casual talks|\bbook/i },
];
const OTHER = "Other / Uncategorized";

function classify(text) {
  for (const c of CATEGORIES) if (c.re.test(text)) return c.name;
  return OTHER;
}

function cleanDescription(desc, maxLen = 500) {
  if (!desc) return "";
  const lines = desc
    .split("\n")
    .filter((line) => !/^\(?\d{1,2}:\d{2}(:\d{2})?\)?[\s.-]/.test(line.trim()));
  let cleaned = lines
    .join(" ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen) + "...";
  return cleaned;
}

async function apiGet(path, params) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`YouTube API error (${path}): ${body?.error?.message || res.statusText}`);
  }
  return body;
}

async function getAllPlaylists(channelId) {
  const playlists = [];
  let pageToken;
  do {
    const data = await apiGet("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: 50,
      pageToken: pageToken || "",
    });
    for (const p of data.items) {
      if (p.contentDetails.itemCount > 0) {
        playlists.push({ id: p.id, title: p.snippet.title });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return playlists;
}

async function getPlaylistVideoIds(playlistId) {
  const ids = [];
  let pageToken;
  do {
    const data = await apiGet("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: 50,
      pageToken: pageToken || "",
    });
    for (const item of data.items) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

function leaf(video, channelKey, language) {
  return {
    id: video.id,
    title: video.title,
    description: cleanDescription(video.description),
    url: video.url,
    channel: channelKey,
    language,
  };
}

function ensureCategory(tree, name) {
  if (!tree[name]) tree[name] = { subcategories: {}, videos: [] };
  return tree[name];
}

async function buildChannelBranch(tree, channelData, channelKey, language) {
  const videoById = new Map(channelData.videos.map((v) => [v.id, v]));
  const claimed = new Set();

  console.log(`\n[${channelData.channel.title}] fetching playlists...`);
  const playlists = await getAllPlaylists(channelData.channel.id);
  console.log(`[${channelData.channel.title}] ${playlists.length} non-empty playlists`);

  for (const pl of playlists) {
    const videoIds = await getPlaylistVideoIds(pl.id);
    const videos = [];
    for (const id of videoIds) {
      const v = videoById.get(id);
      if (!v) continue; // video from another channel (collab) or since removed
      claimed.add(id);
      videos.push(leaf(v, channelKey, language));
    }
    if (!videos.length) continue;

    const category = classify(pl.title);
    const cat = ensureCategory(tree, category);
    cat.subcategories[pl.title] = { channel: channelKey, videos };
  }

  let looseCount = 0;
  for (const v of channelData.videos) {
    if (claimed.has(v.id)) continue;
    const category = classify(v.title);
    const cat = ensureCategory(tree, category);
    cat.videos.push(leaf(v, channelKey, language));
    looseCount++;
  }
  console.log(
    `[${channelData.channel.title}] ${claimed.size} videos categorized via playlists, ${looseCount} via title keywords`
  );
}

async function main() {
  if (!API_KEY) {
    console.error("Missing YT_KEY / YOUTUBE_API_KEY. Add it to .env (see .env.example).");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  const outPath = outIdx !== -1 ? argv[outIdx + 1] : path.join("data", "video-tree.json");
  const files = argv.filter((a, i) => a !== "--out" && argv[i - 1] !== "--out");
  const inputFiles = files.length
    ? files
    : [
        path.join("data", "raw", "Chai_aur_Code-videos.json"),
        path.join("data", "raw", "Hitesh_Choudhary-videos.json"),
        path.join("data", "raw", "Piyush_Garg-videos.json"),
      ];

  // Known languages for the channels this project tracks; anything else
  // defaults to "unknown" and can be set manually in the output if needed.
  const LANGUAGE_BY_TITLE = {
    "Chai aur Code": "hi",
    "Hitesh Choudhary": "en",
    "Piyush Garg": "hi",
  };

  const tree = {};
  const channels = {};

  for (const file of inputFiles) {
    const channelData = JSON.parse(await readFile(file, "utf8"));
    const channelKey = channelData.channel.title.toLowerCase().replace(/\s+/g, "-");
    const language = LANGUAGE_BY_TITLE[channelData.channel.title] || "unknown";
    channels[channelKey] = {
      title: channelData.channel.title,
      id: channelData.channel.id,
      language,
      videoCount: channelData.videos.length,
    };
    await buildChannelBranch(tree, channelData, channelKey, language);
  }

  // sort categories by total video count, descending, for readability
  const sortedTree = {};
  for (const name of Object.keys(tree).sort((a, b) => {
    const count = (c) =>
      c.videos.length + Object.values(c.subcategories).reduce((s, sc) => s + sc.videos.length, 0);
    return count(tree[b]) - count(tree[a]);
  })) {
    sortedTree[name] = tree[name];
  }

  const output = {
    generatedAt: new Date().toISOString(),
    channels,
    tree: sortedTree,
  };

  await writeFile(outPath, JSON.stringify(output, null, 2));

  console.log("\n=== Category summary ===");
  for (const [name, cat] of Object.entries(sortedTree)) {
    const subCount = Object.values(cat.subcategories).reduce((s, sc) => s + sc.videos.length, 0);
    console.log(
      `${name}: ${subCount + cat.videos.length} videos (${Object.keys(cat.subcategories).length} playlists, ${cat.videos.length} loose)`
    );
  }
  console.log(`\nSaved tree to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
