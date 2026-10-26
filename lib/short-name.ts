/** First name for compact selectors; adds the last-name initial when someone else in the list shares the first name (two Paolas). */
export function shortName(name: string, peers: { name: string }[]): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? name;
  const clash = peers.some((p) => p.name !== name && (p.name.trim().split(/\s+/)[0] ?? "").toLowerCase() === first.toLowerCase());
  if (!clash || parts.length < 2) return first;
  const last = parts[parts.length - 1].replace(/\.$/, "");
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}
