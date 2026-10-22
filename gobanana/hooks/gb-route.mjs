// UserPromptSubmit: when the prompt asks to design a page or screen (or for concepts of one), tell Claude to run
// GoBanana before any UI is written, and mark the session so the gate checks its HTML. Never blocks the prompt.
import { isDesignRequest, readSession, readStdin, writeSession } from "./gb-rules.mjs";

const input = await readStdin();
if (isDesignRequest(input.prompt)) {
  writeSession(input.session_id, { ...readSession(input.session_id), design: true, at: Date.now() });
  const n = String(input.prompt).match(/\b(\d{1,2})\s+(?:concepts?|variants?|variations?|versions?|options?|directions?|mock-?ups?)\b/i);
  const context = [
    "GoBanana routing: this prompt asks for page or screen design. Before writing any UI, use the GoBanana skills: gobanana-explore when there is no picked direction yet, gobanana-draft for a picked direction or a draft, and get_playbook with `more` to batch the playbooks a step names. Never hand-write UI concepts outside that flow.",
    "GoBanana tools may carry any prefix (mcp__GoBanana__ from the claude.ai connector, mcp__plugin_gobanana_gobanana__ from the plugin); use whichever is connected. A plugin server that says it requires authentication is harmless when the connector works. With no GoBanana tools at all, tell the user to connect the GoBanana connector at claude.ai or run /mcp.",
    "Directions: the count the user names, else 4, each a different structure (layout skeleton, navigation, spatial model). Never reuse recentIdeas. Taste only as the user gave or confirmed it. If it is unclear which page or screen to design, ask one question or state your reading in one line. End with the canvas web link.",
    n || /concepts?|variants?|variations?|options?|كونسبت/i.test(input.prompt) ? "Several concepts at once: follow playbook gobanana-draft/concept-sheet (one shared content file, a different mechanic and layout per concept, gb-spread checks they differ)." : "",
    "Floor, even before a playbook loads: Arabic in Gulf MSA (no dialect such as عشان or مستني, no English spelled in Arabic letters, no diacritics, Western digits, Latin runs in <bdi>); real data becomes product words (never shell commands, flags, hashes or raw log lines as copy); body 16px or more (17px Arabic), data and labels 14px, nothing read under 14px, AA contrast; first screen: one dominant block, at most 16 controls and 60 text elements, 5 sizes; the look comes from the user's ranked taste words; craft references give finish only; render and measure before showing (playbook gobanana-draft/render-loop).",
  ].filter(Boolean).join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
}
process.exit(0);
