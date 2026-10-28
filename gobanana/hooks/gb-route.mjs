// UserPromptSubmit: only when the user names GoBanana or says "go wild" (or "bananas"), or continues a GoBanana flow
// this session already ran with a design prompt, tell Claude to use the GoBanana skills and mark the session so the
// gate checks its HTML. Any other design task gets nothing (owner 2026-10-26). Never blocks the prompt.
import { asksForGoBanana, flowActive, isDesignRequest, readSession, readStdin, writeSession } from "./gb-rules.mjs";

const input = await readStdin(), session = readSession(input.session_id);
const continues = (p) => isDesignRequest(p) || /\b(picks?|drafts?|directions?|board|canvas|frankenstein)\b/i.test(String(p || ""));
if (asksForGoBanana(input.prompt) || (flowActive(session) && continues(input.prompt))) {
  writeSession(input.session_id, { ...session, design: true, at: Date.now() });
  const n = String(input.prompt).match(/\b(\d{1,2})\s+(?:concepts?|variants?|variations?|versions?|options?|directions?|mock-?ups?)\b/i);
  const context = [
    "GoBanana routing: the user asked for GoBanana or continues a GoBanana flow. Use the GoBanana skills: gobanana-explore when there is no picked direction yet, gobanana-draft for a picked direction or a draft, and get_playbook with `more` to batch the playbooks a step names. Other design work in this session stays outside GoBanana unless the user asks for it.",
    "GoBanana tools may carry any prefix (mcp__GoBanana__ from the claude.ai connector, mcp__plugin_gobanana_gobanana__ from the plugin); use whichever is connected. A plugin server that says it requires authentication is harmless when the connector works. With no GoBanana tools at all, tell the user to connect the GoBanana connector at claude.ai or run /mcp.",
    "Directions: the count the user names, else 4, each a different way to get the job done with its own hero reference, keeping every must-keep. Never reuse recentIdeas. Taste only as the user gave or confirmed it; it picks the heroes. If it is unclear which page or screen to design, ask one question or state your reading in one line. End with the canvas web link.",
    n || /concepts?|variants?|variations?|options?|كونسبت/i.test(input.prompt) ? "Several concepts at once: follow playbook gobanana-draft/concept-sheet (one shared content file, a different mechanic and layout per concept, gb-spread checks they differ)." : "",
    "Floor, even before a playbook loads: the look comes from each direction's hero reference (its palette, type, imagery, density and depth; its principles, never its props or layout); one language, English unless the user asked for another (the Arabic rules only on an Arabic page); accessibility only: AA contrast, body 16px, nothing read under 14px, 44px tap targets, no sideways scroll, alt text, visible focus; real product words, nothing invented; render and measure before showing (playbook gobanana-draft/render-loop).",
  ].filter(Boolean).join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
}
process.exit(0);
