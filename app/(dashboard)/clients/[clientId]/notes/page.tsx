import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTasks } from "@/lib/permissions";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { ClientNotes } from "@/components/notes/client-notes";
import { noteSelect, toNoteDTO } from "@/lib/client-notes";

type Props = { params: Promise<{ clientId: string }> };

export const metadata = { title: "Notes" };
export const dynamic = "force-dynamic";

/** Notes tab: meeting notes and background per client, one note per meeting or topic. */
export default async function NotesPage({ params }: Props) {
  const user = await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true },
  });
  if (!client) notFound();
  const availabilityNow = await availabilityNowFor(client.id);

  const notes = await db.clientNote.findMany({ where: { clientId }, select: noteSelect, orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }] });

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow} client={client} counts={{ notes: notes.length }} />
      <ClientNotes clientId={clientId} notes={notes.map(toNoteDTO)} canEdit={canManageTasks(user)} />
    </>
  );
}
