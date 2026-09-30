"use client";

import { useState } from "react";
import { CalendarPlus, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/form-field";

/** The runner's private iCal feed: subscribe once in Google/Apple Calendar and every pauta shows up by itself. */
export function CalendarSyncCard({ feedUrl }: { feedUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the field below is selectable */
    }
  }
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:/, "webcal:"))}`;
  return (
    <Card padding="none" className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-primary">Sync with Google Calendar</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Subscribe once and all your pautas appear in your calendar, with times, address and internal notes. Changes sync on their own (Google refreshes every few hours).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Calendar feed URL" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-1 px-3 text-xs text-ink-secondary" />
            <Button type="button" variant="secondary" onClick={() => void copy()} leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} className="h-10">
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button asChild className="h-10">
              <a href={google} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            If the button doesn&apos;t open it: Google Calendar → Other calendars → + → <strong>From URL</strong> → paste the link. On iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar.
          </p>
        </div>
      </div>
    </Card>
  );
}
