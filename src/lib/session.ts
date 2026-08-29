const KEY = "team_session";

export type TeamSession = {
  username: string;
  password: string;
  isAdmin: boolean;
};

export function getSession(): TeamSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TeamSession;
  } catch {
    return null;
  }
}

export function setSession(s: TeamSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

// Credentials to merge into API request bodies for authenticated endpoints.
export function authFields(): { username: string; password: string } {
  const s = getSession();
  return { username: s?.username ?? "", password: s?.password ?? "" };
}
