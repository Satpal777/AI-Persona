// In-memory chat store: one message array per (uid, persona) pair.
// Nothing is persisted — a server restart wipes every chat, by design.
// globalThis keeps the Map alive across Next.js dev hot-reloads.

const store = (globalThis.__chatStore ??= new Map());

const MAX_MESSAGES = 40;
const key = (uid, personaId) => `${uid}:${personaId}`;

export function getHistory(uid, personaId) {
  return store.get(key(uid, personaId)) ?? [];
}

export function appendMessages(uid, personaId, ...messages) {
  const k = key(uid, personaId);
  const list = [...(store.get(k) ?? []), ...messages];
  store.set(k, list.slice(-MAX_MESSAGES));
}
