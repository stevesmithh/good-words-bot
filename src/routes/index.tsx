import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, LogOut, Share2, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailGenerator } from "@/components/EmailGenerator";
import { SmsGenerator } from "@/components/SmsGenerator";
import { SocialGenerator } from "@/components/SocialGenerator";
import { DedupTool } from "@/components/DedupTool";
import { AdminButton } from "@/components/AdminEditor";
import { Button } from "@/components/ui/button";
import { clearSession, getSession } from "@/lib/session";

const SHARE_IMAGE =
  "https://text.sigmaworkzone.com/__l5e/assets-v1/37201651-cf1e-4081-8c26-34a27c881c07/sigma_share_card.jpg";

type Tab = "email" | "sms" | "social" | "dedup";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Copy Generator" },
      {
        name: "description",
        content: "SMS, email, and social promotion copy generator for marketing campaigns.",
      },
      { property: "og:title", content: "Copy Generator" },
      { property: "og:description", content: "SMS, email, and social promotion copy generator for marketing campaigns." },
      { name: "twitter:title", content: "Copy Generator" },
      { name: "twitter:description", content: "SMS, email, and social promotion copy generator for marketing campaigns." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://text.sigmaworkzone.com/" },
      { property: "og:image", content: SHARE_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: SHARE_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
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
              {session.isAdmin ? "Admin" : "Signed in"}
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
          <TabButton active={tab === "dedup"} onClick={() => setTab("dedup")}>
            <Users className="h-4 w-4" />
            Dedup
          </TabButton>
        </div>

        {tab === "email" ? (
          <EmailGenerator />
        ) : tab === "sms" ? (
          <SmsGenerator />
        ) : tab === "social" ? (
          <SocialGenerator />
        ) : (
          <DedupTool />
        )}
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
