import { getSession } from "@/lib/session";

export async function logGeneration(kind: "email" | "sms") {
  const s = getSession();
  if (!s) return;
  try {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "logGeneration",
        username: s.username,
        password: s.password,
        kind,
      }),
    });
  } catch {
    // best-effort logging; do not interrupt UX
  }
}

export async function logHistory(opts: {
  kind: "email" | "sms" | "social";
  label?: string | null;
  input: unknown;
  output: unknown;
}) {
  const s = getSession();
  if (!s) return;
  try {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "logHistory",
        username: s.username,
        password: s.password,
        kind: opts.kind,
        label: opts.label ?? null,
        input: opts.input,
        output: opts.output,
      }),
    });
  } catch {
    // best-effort
  }
}
