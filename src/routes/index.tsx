import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, LogOut, Share2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailGenerator } from "@/components/EmailGenerator";
import { SmsGenerator } from "@/components/SmsGenerator";
import { SocialGenerator } from "@/components/SocialGenerator";
import { AdminButton } from "@/components/AdminEditor";
import { Button } from "@/components/ui/button";
import { clearSession, getSession } from "@/lib/session";

type Tab = "email" | "sms" | "social";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Copy Generator — Inbox-Safe Emails & SMS" },
      {
        name: "description",
        content:
          "Generate promotional emails and bulk SMS designed to land in the primary inbox and pass US carrier filters.",
      },
    ],
  }),
});

function Index() {
  const [tab, setTab] = useState<Tab>("email");
  const session = getSession();

  const handleLogout = () => {
    clearSession();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Copy Generator</h1>
            <p className="text-xs text-muted-foreground">
              Inbox-safe emails and carrier-friendly bulk SMS.
            </p>
          </div>
          {session && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Signed in as <strong className="font-medium text-foreground">{session.username}</strong>
              {session.isAdmin && " (admin)"}
            </span>
          )}
          {session && (
            <Link to="/history">
              <Button variant="outline" size="sm" className="gap-2" title="View past generations">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </Link>
          )}
          {session?.isAdmin && <AdminButton />}
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2" title="Sign out">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>


      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Tab switcher */}
        <div className="mb-6 inline-flex rounded-lg border bg-background p-1">
          <TabButton active={tab === "email"} onClick={() => setTab("email")}>
            <Mail className="h-4 w-4" />
            Email
          </TabButton>
          <TabButton active={tab === "sms"} onClick={() => setTab("sms")}>
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabButton>
          <TabButton active={tab === "social"} onClick={() => setTab("social")}>
            <Share2 className="h-4 w-4" />
            Social
          </TabButton>
        </div>

        {tab === "email" ? <EmailGenerator /> : tab === "sms" ? <SmsGenerator /> : <SocialGenerator />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
