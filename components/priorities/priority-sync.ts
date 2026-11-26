"use client";

import { useEffect, useRef } from "react";
import type { PriorityItem } from "./helpers";

// The Urgentes card and the board sections are separate components showing the same lines: a change made in one
// is announced here so the other updates at once, without waiting for the server refresh.

const EVENT = "ebpr:priority-change";

export type PriorityChange = { type: "update"; item: PriorityItem } | { type: "delete"; id: string };

export function announcePriorityChange(change: PriorityChange) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PriorityChange>(EVENT, { detail: change }));
}

export function usePriorityChanges(handler: (change: PriorityChange) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = (e: Event) => ref.current((e as CustomEvent<PriorityChange>).detail);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
}

/** Apply a change announced elsewhere to a board's own copy of its lines (lines it does not hold are ignored). */
export function applyPriorityChange<T extends PriorityItem>(items: T[], change: PriorityChange): T[] {
  if (change.type === "delete") return items.some((i) => i.id === change.id) ? items.filter((i) => i.id !== change.id) : items;
  return items.some((i) => i.id === change.item.id) ? items.map((i) => (i.id === change.item.id ? { ...i, ...change.item, list: i.list ?? change.item.list } : i)) : items;
}
