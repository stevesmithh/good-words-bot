import { useState } from "react";
import { Eye, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function LinkPreviewButton({ url, label = "Preview" }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setOpen(true)}>
        <Eye className="h-3.5 w-3.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3 p-4">
          <DialogHeader>
            <DialogTitle>Link preview</DialogTitle>
            <DialogDescription className="truncate">{url}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </a>
            </Button>
          </div>
          <iframe
            src={url}
            title="Link preview"
            className="w-full flex-1 rounded-md border bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
          <p className="text-xs text-muted-foreground">
            If the page stays blank, the site blocks previews — use "Open in new tab".
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
