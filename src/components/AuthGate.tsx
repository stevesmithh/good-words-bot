import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";
import { clearSession, getSession, setSession } from "@/lib/session";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      setReady(true);
      return;
    }
    // Re-verify stored credentials so removed/changed logins are signed out.
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username: s.username, password: s.password }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setSession({ username: data.username, password: s.password, isAdmin: !!data.isAdmin });
          setSignedIn(true);
        } else if (res.status < 500) {
          clearSession();
        } else {
          setSignedIn(true);
        }
      })
      .catch(() => setSignedIn(true))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signedIn) return <LoginScreen onSignedIn={() => setSignedIn(true)} />;
  return <>{children}</>;
}

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Login failed");
        return;
      }
      setSession({ username: data.username, password, isAdmin: !!data.isAdmin });
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" /> Sign in
          </CardTitle>
          <CardDescription>Enter your team credentials to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !username || !password}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
