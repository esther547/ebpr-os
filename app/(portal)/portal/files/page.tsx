import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatBytes, getFileIcon } from "@/lib/utils";
import { FileText, Image, Table, Video, File, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

const ICON_MAP: Record<string, React.ReactNode> = {
  "file-text": <FileText className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  file: <File className="h-4 w-4" />,
};

export default async function PortalFilesPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

  const files = await db.file.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
    },
    orderBy: { createdAt: "desc" },
    include: {
      deliverable: { select: { id: true, title: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title="Files"
        subtitle="Documents and assets shared by your EBPR team"
      />

      {files.length === 0 ? (
        <EmptyState
          icon={<File />}
          title="No files shared yet"
          description="Documents and assets your EBPR team shares with you will appear here."
        />
      ) : (
        <Card padding="none" className="divide-y divide-border overflow-hidden">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-1"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-secondary">
                {ICON_MAP[getFileIcon(file.mimeType)] || ICON_MAP.file}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-primary">{file.name}</p>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  {file.deliverable ? `${file.deliverable.title} · ` : ""}
                  Uploaded by {file.uploadedBy.name} · {formatDate(file.createdAt)}
                  {file.size ? ` · ${formatBytes(file.size)}` : ""}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </Card>
      )}
    </div>
  );
}
