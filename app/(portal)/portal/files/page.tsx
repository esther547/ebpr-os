import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatBytes, getFileIcon } from "@/lib/utils";
import { FileText, Image, Table, Video, File } from "lucide-react";

export const metadata = { title: "Files" };

const ICON_MAP: Record<string, React.ReactNode> = {
  "file-text": <FileText className="h-5 w-5 text-blue-500" />,
  image: <Image className="h-5 w-5 text-purple-500" />,
  table: <Table className="h-5 w-5 text-green-500" />,
  video: <Video className="h-5 w-5 text-amber-500" />,
  file: <File className="h-5 w-5 text-ink-muted" />,
};

export default async function PortalFilesPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");

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
    <div>
      <h1 className="text-xl font-semibold text-ink-primary mb-1">Files</h1>
      <p className="text-sm text-ink-muted mb-6">Documents and assets shared by your EBPR team</p>

      {files.length === 0 ? (
        <div className="text-center py-20">
          <File className="mx-auto h-10 w-10 text-ink-muted mb-3" />
          <p className="text-sm text-ink-muted">No files shared yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="divide-y divide-border">
            {files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-5 py-4 hover:bg-surface-1 transition-colors"
              >
                <div className="shrink-0">
                  {ICON_MAP[getFileIcon(file.mimeType)] || ICON_MAP.file}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-primary truncate">{file.name}</p>
                  <p className="text-2xs text-ink-muted mt-0.5">
                    {file.deliverable ? `${file.deliverable.title} · ` : ""}
                    Uploaded by {file.uploadedBy.name} · {formatDate(file.createdAt)}
                    {file.size ? ` · ${formatBytes(file.size)}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
