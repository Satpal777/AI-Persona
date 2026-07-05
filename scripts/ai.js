import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

try {
    process.loadEnvFile();
} catch {
    console.log("env error");
}

const client = new OpenAI({
    baseURL: process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: process.env.AI_KEY,
});

const MODEL = process.env.AI_MODEL || 'gemini-2.5-flash';

const STYLE_NOTES = await readFile(path.join('data', 'prompts', 'style.txt'), 'utf8');
const VIDEO_TREE = JSON.parse(await readFile(path.join('data', 'video-tree.json'), 'utf8'));
const CATEGORIES = Object.keys(VIDEO_TREE.tree);

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'is', 'are',
    'how', 'what', 'with', 'video', 'videos', 'course', 'tutorial', 'learn',
    'complete', 'hindi', 'english', 'me', 'ka', 'ki', 'ke', 'hai', 'kya', 'se',
    'par', 'aur', 'kaise',
]);

function tokenize(text) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function searchVideos({ category, query, language } = {}, limit = 8) {
    const terms = [...new Set(tokenize(query || ''))];
    const branch = VIDEO_TREE.tree[category];
    const cats = branch ? [[category, branch]] : Object.entries(VIDEO_TREE.tree);

    const scored = [];
    for (const [catName, cat] of cats) {
        const buckets = [
            ...Object.entries(cat.subcategories).map(([name, sc]) => ({ name, videos: sc.videos })),
            { name: null, videos: cat.videos },
        ];
        for (const bucket of buckets) {
            const bucketName = bucket.name ? bucket.name.toLowerCase() : '';
            for (const v of bucket.videos) {
                if (language && v.language !== language) continue;
                const title = v.title.toLowerCase();
                const desc = (v.description || '').toLowerCase();
                let score = 0;
                for (const term of terms) {
                    if (title.includes(term)) score += 3;
                    if (bucketName.includes(term)) score += 2;
                    if (desc.includes(term)) score += 1;
                }
                if (score > 0) {
                    scored.push({ score, category: catName, playlist: bucket.name, video: v });
                }
            }
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ category: cat, playlist, video }) => ({
        id: video.id,
        title: video.title,
        url: video.url,
        channel: video.channel,
        language: video.language,
        category: cat,
        playlist,
        description: (video.description || '').slice(0, 200),
    }));
}

const SYSTEM_PROMPT = `
You are Hitesh Choudhary — Indian coding teacher, founder of the "Chai aur Code"
(Hindi) and "Hitesh Choudhary" (English) YouTube channels. You always answer AS
Hitesh, in his voice, never as an AI.

Persona & speaking style (follow strictly):
${STYLE_NOTES}

You solve every user message through a pipeline of "START", "THINK", "TOOL",
"OBSERVE" and "OUTPUT" steps:
- "START": your first read of what the user is actually asking.
- "THINK": break the problem down and plan the answer. Can repeat.
- "TOOL": call a tool when you need real data. The system will reply with an
  "OBSERVE" message containing the tool result.
- "OUTPUT": the final answer to the user, fully in persona.

Available tool:
- "search_videos": searches real videos from both channels.
  input: { "category": "<one category from the list below>", "query": "<3-6 topic keywords>", "language": "hi" | "en" | null }
  Use language "hi" for Chai aur Code (Hindi), "en" for the English channel,
  null when the user has no preference.

Video categories: ${CATEGORIES.join(', ')}

Rules:
- Output exactly ONE step per response, as a single JSON object. No markdown,
  no code fences, no text outside the JSON.
- Whenever the user asks about a topic, tutorial, course or "which video",
  you MUST use the "search_videos" tool before giving the OUTPUT.
- After an OBSERVE, filter the results yourself: recommend only the 1-3 most
  relevant videos. If nothing genuinely matches, say so honestly — NEVER
  invent a video title or URL that was not in the OBSERVE results.
- START/THINK steps are internal, keep them short and in plain English. The
  OUTPUT content must be in Hitesh's Hinglish voice per the style notes, and
  must mention each recommended video's title and url naturally.

Output format (one JSON object per response):
{ "step": "START" | "THINK" | "OUTPUT", "content": "<text>" }
{ "step": "TOOL", "tool": "search_videos", "input": { "category": "...", "query": "...", "language": "hi" | "en" | null } }
`;


const MESSAGES_DB = [{ role: 'system', content: SYSTEM_PROMPT }];
const MAX_STEPS = 20;


function parseStep(raw) {
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object found');
    return JSON.parse(cleaned.slice(start, end + 1));
}

async function chat(prompt = '') {
    MESSAGES_DB.push({ role: 'user', content: prompt });

    for (let i = 0; i < MAX_STEPS; i++) {
        const result = await client.chat.completions.create({
            model: MODEL,
            messages: MESSAGES_DB,
            response_format: { type: 'json_object' },
        });

        const rawResult = result.choices[0].message.content;
        MESSAGES_DB.push({ role: 'assistant', content: rawResult });

        let parsed;
        try {
            parsed = parseStep(rawResult);
        } catch {
            console.log('⚠️  (RETRY): model sent invalid JSON, asking it to resend');
            MESSAGES_DB.push({
                role: 'user',
                content: 'Your last reply was not a single valid JSON step object. Resend that step as valid JSON only.',
            });
            continue;
        }

        const step = (parsed.step || '').toUpperCase();

        if (step === 'TOOL') {
            console.log(`🛠️  (TOOL ${parsed.tool}): ${JSON.stringify(parsed.input)}`);
            const results = parsed.tool === 'search_videos' ? searchVideos(parsed.input) : [];
            console.log(`👀 (OBSERVE): ${results.length} video(s) found`);
            MESSAGES_DB.push({
                role: 'user',
                content: JSON.stringify({ step: 'OBSERVE', tool: parsed.tool, results }),
            });
            continue;
        }

        if (step === 'OUTPUT') {
            console.log(`\n🤖 Hitesh: ${parsed.content}\n`);
            return parsed.content;
        }

        console.log(`🧠 (${step}): ${parsed.content}`);
    }

    console.log('⚠️  Stopped: no OUTPUT step after too many turns.');
    return null;
}

const argPrompt = process.argv.slice(2).join(' ').trim();

if (argPrompt) {
    await chat(argPrompt);
} else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('☕ Chai aur Code assistant — poochho kuch bhi (type "exit" to quit)\n');
    while (true) {
        const q = (await rl.question('you > ')).trim();
        if (!q) continue;
        if (q.toLowerCase() === 'exit') break;
        await chat(q);
    }
    rl.close();
}