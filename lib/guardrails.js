// Security Guardrails for AI Persona Chat

const SENSITIVE_PATTERNS = [
  // API Keys & Secret Tokens
  /AIzaSy[A-Za-z0-9_-]{33}/i,
  /sk-or-v1-[A-Za-z0-9]{32,}/i,
  /sk-[A-Za-z0-9_-]{20,}/i,
  /process\.env\.[A-Za-z0-9_]+/i,
  /AI_KEY/i,
  /YT_KEY/i,
  /YOUTUBE_API_KEY/i,

  // System Prompt Extraction Attempts / Meta Leaks
  /You solve every user message through a pipeline/i,
  /Persona & speaking style \(follow strictly\):/i,
  /Available tool: "search_videos"/i,
];

export function sanitizeText(text) {
  if (!text || typeof text !== "string") return "";

  let sanitized = text;
  sanitized = sanitized.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, "[REDACTED_API_KEY]");
  sanitized = sanitized.replace(/sk-or-v1-[A-Za-z0-9]{32,}/g, "[REDACTED_API_KEY]");
  sanitized = sanitized.replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]");

  return sanitized;
}

export function applyGuardrails(replyText, persona) {
  if (!replyText || typeof replyText !== "string") {
    return persona?.id === "piyush"
      ? "Chalo yaar wapas coding pe aate hain. Koi technical question poochho!"
      : "Dekho yaar, aao wapas coding aur career pe baat karte hain! Theek hai?";
  }

  const sanitized = sanitizeText(replyText);

  // Check for prompt leaks or secret exposure
  const isViolation = SENSITIVE_PATTERNS.some((pattern) => pattern.test(replyText));

  if (isViolation) {
    console.warn("⚠️ Guardrail Triggered: Secret or System Prompt leakage prevented.");
    return persona?.id === "piyush"
      ? "Dekho, yeh sab out of context hai. Main toh full stack, system design aur coding pe hi baat karta hoon. Wapas topic pe aate hain, right?"
      : "Dekho yaar, yeh apni expertise se bahar ki baat hai. Aao wapas coding, projects aur career pe charcha karte hain! Theek hai?";
  }

  return sanitized;
}
