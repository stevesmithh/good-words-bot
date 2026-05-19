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
