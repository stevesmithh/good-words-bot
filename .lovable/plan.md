
# Fix email body formatting (less robotic, more human)

The current output puts every sentence on its own line, which looks like a checklist instead of a real email. Goal: make the body read like a normal human-written email — sentences flow in paragraphs, with line breaks used only where they actually belong.

## What changes

Only `src/routes/api/generate-email.ts` — prompt + tool description. No UI changes needed.

### New body formatting rules (added to prompt)

- Body is structured as **2–3 short paragraphs**, separated by a blank line.
- Sentences inside a paragraph flow naturally on the same line — do NOT put every sentence on its own line.
- Suggested structure:
  1. **Opening paragraph** (1–3 sentences): warm opener tailored to the audience, leading into why you're writing.
  2. **Rewards block**: short intro line, then each reward on its own line as a compact list (this is the ONLY place line breaks per item are allowed). Format each reward line as `Label: value` (e.g. `Goldmine Rewards: up to $300 weekly`).
  3. **Closing paragraph** (1–2 sentences): a soft, low-pressure nudge about where to find it / how to use it. No "click here", no "buy now".
- Use `\n\n` between paragraphs (blank line) and single `\n` only between reward items.
- Do not start every sentence on a new line.
- Keep the existing rules: ≤20 words per sentence, no "I"/"We" sentence starts, no exclamation marks, no urgency language, simple everyday words.

### Tool schema tweak

Update the `body` parameter description so the model knows the expected shape:

> "Email body as 2–3 short paragraphs separated by a blank line (\\n\\n). Sentences inside a paragraph flow on the same line — do not break every sentence onto its own line. The rewards block is the only place where individual items go on their own lines."

### Rendering

The UI already renders the body with `whitespace-pre-wrap`, so paragraph breaks (`\n\n`) and the reward list (`\n`) will display correctly with no UI change.

## Result

Output will look like a normal email — flowing opening paragraph, a tidy rewards list in the middle, and a calm closing paragraph — instead of one sentence per line top to bottom.
