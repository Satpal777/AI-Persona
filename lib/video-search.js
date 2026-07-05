// Keyword search over video-tree.json (built by build-tree.js).
// Loaded once per server process and cached.
//
// When a `personaChannels` map is provided, own-channel videos get a score
// boost so they rank first, and peer-channel videos are returned in a
// separate `crossVideos` array for cross-referencing.

import { readFile } from "node:fs/promises";
import path from "node:path";

let treePromise = null;

function loadTree() {
  treePromise ??= readFile(path.join(process.cwd(), "data", "video-tree.json"), "utf8").then(JSON.parse);
  return treePromise;
}

export async function getCategories() {
  return Object.keys((await loadTree()).tree);
}

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "of", "for", "to", "and", "or", "is", "are",
  "how", "what", "with", "video", "videos", "course", "tutorial", "learn",
  "complete", "hindi", "english", "me", "ka", "ki", "ke", "hai", "kya", "se",
  "par", "aur", "kaise",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Returns the best-scoring videos for a {category, query, language} input.
 *
 * When `personaChannels` is provided (e.g. { own: ["piyush-garg"], peer: ["chai-aur-code", "hitesh-choudhary"] }),
 * own-channel videos get a +5 score boost so they rank above peer videos.
 * The return value then includes a `crossVideos` array with top peer-channel
 * matches that the persona can cross-reference ("Hitesh sir ka bhi video hai").
 */
export async function searchVideos({ category, query, language } = {}, { personaChannels, limit = 8 } = {}) {
  const { tree } = await loadTree();
  const terms = [...new Set(tokenize(query || ""))];
  const branch = tree[category];
  const cats = branch ? [[category, branch]] : Object.entries(tree);

  const ownChannels = new Set(personaChannels?.own || []);
  const peerChannels = new Set(personaChannels?.peer || []);
  const hasChannelFilter = ownChannels.size > 0;

  const scored = [];
  for (const [catName, cat] of cats) {
    const buckets = [
      ...Object.entries(cat.subcategories).map(([name, sc]) => ({ name, videos: sc.videos })),
      { name: null, videos: cat.videos },
    ];
    for (const bucket of buckets) {
      const bucketName = bucket.name ? bucket.name.toLowerCase() : "";
      for (const v of bucket.videos) {
        if (language && v.language !== language) continue;
        const title = v.title.toLowerCase();
        const desc = (v.description || "").toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (title.includes(term)) score += 3;
          if (bucketName.includes(term)) score += 2;
          if (desc.includes(term)) score += 1;
        }
        if (score > 0) {
          // Boost own-channel videos so they always rank above peer videos
          const isOwn = hasChannelFilter && ownChannels.has(v.channel);
          const isPeer = hasChannelFilter && peerChannels.has(v.channel);
          if (isOwn) score += 5;
          scored.push({
            score,
            isOwn,
            isPeer,
            category: catName,
            playlist: bucket.name,
            video: v,
          });
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const formatVideo = ({ category: cat, playlist, video }) => ({
    id: video.id,
    title: video.title,
    url: video.url,
    channel: video.channel,
    language: video.language,
    category: cat,
    playlist,
    thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    description: (video.description || "").slice(0, 200),
  });

  if (!hasChannelFilter) {
    // No persona context — return everything ranked as before
    return {
      videos: scored.slice(0, limit).map(formatVideo),
      crossVideos: [],
    };
  }

  // Split: own-channel results first, then peer-channel results for cross-referencing
  const ownResults = scored.filter((s) => s.isOwn).slice(0, limit);
  const peerResults = scored.filter((s) => s.isPeer).slice(0, 3);

  return {
    videos: ownResults.map(formatVideo),
    crossVideos: peerResults.map(formatVideo),
  };
}
