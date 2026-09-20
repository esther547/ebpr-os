"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string | null;
  isRead: boolean;
  link: string | null;
  createdAt: string | Date;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data.data) ? data.data : []);
        setUnreadCount(Number(data.unreadCount) || 0);
      }
    } catch {
      // Network hiccup: keep the last known state and retry on the next poll
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh when the dropdown is opened so the list is current
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markRead(n: Notification) {
    if (n.isRead) return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      // keepalive so the request survives an immediate navigation
      await fetch(`/api/notifications/${n.id}`, { method: "PUT", keepalive: true });
    } catch {
      // Will be corrected by the next poll
    }
  }

  async function handleClick(n: Notification) {
    await markRead(n);
    if (n.link) {
      setOpen(false);
      window.location.href = n.link;
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink-primary transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-white shadow-lg overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-ink-primary">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-surface-1 transition-colors ${
                      !n.isRead ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-primary">{n.title}</p>
                        <p className="text-xs text-ink-secondary mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-2xs text-ink-muted mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-ink-muted">No notifications</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
