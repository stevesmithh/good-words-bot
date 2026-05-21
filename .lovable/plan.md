# Stabilize and speed up SMS generation

## Problem
The SMS generator currently feels slow, often repeats itself, and sometimes fails with `API error: 502 — Could not parse response`.

The likely causes are:
- Two separate AI generations run for every request (6 regular variants + 3 no-spam variants).
- Each call includes large prompt instructions plus recent-history blocks, which increases latency.
- The model is set to high randomness (`temperature: 1.0`, `top_p: 0.95`), which helps variety but also makes function-call output less reliable.
- The anti-repetition memory currently adds too much prompt weight for a tool that needs to be fast and stable for daily team use.

## Goal
- Faster SMS generation
- Stable output with far fewer 502 parse failures
- Better variation between runs
- Keep all 9 outputs, including the no-spam set
- Preserve carrier-safe / no-spam constraints

## Plan

### 1. Make the AI response path more reliable
- Lower creativity slightly for structured tool calls so the model still varies wording but follows the expected response shape more consistently.
- Add a retry/fallback path in the server helper:
  - first attempt: balanced creativity for variety
  - automatic retry on parse failure: lower temperature and simplified prompt pressure
- Improve server-side error handling so malformed tool output does not surface as a vague failure when it can be recovered.

### 2. Reduce prompt weight to improve speed
- Shrink the recent-history payload from the current large blocks to a smaller, high-signal sample.
- Trim seed instructions so they still force diversity without overloading the model.
- Keep no-spam rules strict, but remove redundant wording from the prompt.

### 3. Keep uniqueness without slowing the tool down
- Retain recent-output memory, but make it lighter:
  - fewer recent examples per group
  - emphasize “don’t mirror openings/shape” instead of sending long history every time
- Keep randomized opener/shape/tone seeds so outputs still differ across runs even after reducing history.
- Tune the balance toward fast, distinct copy instead of maximum novelty.

### 4. Optimize the no-spam generation path
- Keep the no-spam variants automatic and always included on the right side with the other outputs.
- Simplify the no-spam prompt to prioritize safety and deterministic formatting.
- If needed, make the no-spam call stricter than the marketing/casual call so it stays stable without hurting the other variants.

### 5. Improve user-facing failure behavior
- Return clearer API errors from the SMS route.
- Expose raw failure details in a safer, more useful way for debugging instead of only “Could not parse response”.
- Ensure one unstable sub-call does not unnecessarily break the whole generation when a graceful fallback is possible.

## Expected outcome
- Noticeably faster generation time
- Much fewer 502 parse failures
- More diverse SMS text from day to day
- No-spam variants remain safe and present in every generation
- Better stability for daily team use

## Technical details
- Update `src/server/anthropic.server.ts` to support retry/fallback behavior for malformed tool-call responses.
- Update `src/routes/api/generate-sms.ts` to reduce prompt size, tune generation settings, and degrade gracefully when one branch misbehaves.
- Update `src/server/sms-variation.server.ts` to make anti-repetition lighter and faster.
- Keep database changes minimal unless a small cleanup is needed; priority is app speed and stability, not expanding backend complexity.

## Out of scope
- No redesign of the SMS UI
- No async job/webhook architecture unless the lighter synchronous fix still proves too slow after tuning
- No changes to email generation