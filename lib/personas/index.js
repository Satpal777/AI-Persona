import hitesh from "./hitesh";
import piyush from "./piyush";

// To add a persona: create lib/personas/<name>.js (copy hitesh.js as a
// template) and register it here. Landing page, chat page and API pick it up.
export const PERSONAS = {
  [hitesh.id]: hitesh,
  [piyush.id]: piyush,
};

// Client-safe subset: everything except the prompt internals.
export function publicPersona({ id, name, tagline, avatar, topics, greeting }) {
  return { id, name, tagline, avatar, topics, greeting };
}
