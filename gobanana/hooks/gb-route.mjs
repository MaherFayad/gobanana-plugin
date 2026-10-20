// UserPromptSubmit: when the prompt asks to design a page or screen (or for concepts of one), tell Claude to run
// GoBanana before any UI is written, and mark the session so the gate checks its HTML. Never blocks the prompt.
import { isDesignRequest, readSession, readStdin, writeSession } from "./gb-rules.mjs";

const input = await readStdin();
if (isDesignRequest(input.prompt)) {
  writeSession(input.session_id, { ...readSession(input.session_id), design: true, at: Date.now() });
  const n = String(input.prompt).match(/\b(\d{1,2})\s+(?:concepts?|variants?|variations?|versions?|options?|directions?|mock-?ups?)\b/i);
  const context = [
    "GoBanana routing: this prompt asks for page or screen design. Before writing any UI, use the GoBanana skills: gobanana-explore when there is no picked direction yet, gobanana-draft for a picked direction or a draft, and get_playbook with `more` to batch the playbooks a step names. Never hand-write UI concepts outside that flow.",
    n || /concepts?|variants?|variations?|options?|كونسبت/i.test(input.prompt) ? "Several concepts at once: follow playbook gobanana-draft/concept-sheet (one shared content file, a different mechanic and layout per concept, gb-spread checks they differ)." : "",
    "Floor, even before a playbook loads: Arabic in Gulf MSA (no dialect such as عشان or مستني, no English spelled in Arabic letters, no diacritics, Western digits, Latin runs in <bdi>); real data becomes product words (never shell commands, flags, hashes or raw log lines as copy); body 16px or more (17px Arabic), nothing read under 12px, AA contrast (WCAG 2.2 SC 1.4.3); the look comes from the user's ranked taste words and the craft references, not a dark dashboard default; render and measure before showing (playbook gobanana-draft/render-loop).",
  ].filter(Boolean).join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
}
process.exit(0);
