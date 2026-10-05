/** Shared select for the client Notes tab (meeting notes / background). */
export const noteSelect = { id: true, title: true, body: true, meetingDate: true, createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } } } as const;

export type ClientNoteDTO = {
  id: string;
  title: string;
  body: string;
  meetingDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
};

export const toNoteDTO = (n: { id: string; title: string; body: string; meetingDate: Date | null; createdAt: Date; updatedAt: Date; createdBy: { id: string; name: string } | null }): ClientNoteDTO => ({
  ...n,
  meetingDate: n.meetingDate ? n.meetingDate.toISOString().slice(0, 10) : null,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});
