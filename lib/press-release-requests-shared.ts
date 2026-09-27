// Client-safe types and labels for press-release requests (no server imports here).

export type RequestStatus = "REQUESTED" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  REQUESTED: "Solicitado",
  IN_PROGRESS: "En redacción",
  DONE: "Entregado",
  CANCELLED: "Cancelado",
};

export const requestSelect = {
  id: true,
  clientId: true,
  news: true,
  dueDate: true,
  photosUrl: true,
  info: true,
  status: true,
  draftUrl: true,
  writerNotes: true,
  doneAt: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
} as const;

export type PressReleaseRequestItem = {
  id: string;
  clientId: string;
  news: string;
  dueDate: string;
  photosUrl: string | null;
  info: string | null;
  status: string;
  draftUrl: string | null;
  writerNotes: string | null;
  doneAt: string | null;
  createdAt: string;
  client: { id: string; name: string };
  requestedBy: { id: string; name: string; email: string };
};

