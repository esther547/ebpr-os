import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatBytes } from "@/lib/utils";
import { FileText, Image, Table, Video, File as FileIcon } from "lucide-react";

type Props = { params: { clientId: string } };

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

const ICON_MAP: Record<string, React.ReactNode> = {
  image: <Image className="h-5 w-5 text-blue-500" />,
  "file-text": <FileText className="h-5 w-5 text-red-500" />,
  table: <Table className="h-5 w-5 text-green-500" />,
  video: <Video className="h-5 w-5 text-purple-500" />,
  file: <FileIcon className="h-5 w-5 text-ink-muted" />,
};

function getIconType(mimeType: string | null | undefined): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "file-text";
  if (mimeType.includes("word")) return "file-text";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "table";
  if (mimeType.includes("video")) return "video";
  return "file";
}

export default async function ClientFilesPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true },
  });

  if (!client) notFound();

  const files = await db.file.findMany({
    where: { clientId: params.clientId },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
    },
  });

  return (
    <div>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Files ({files.length})
      </h2>

      {files.length > 0 ? (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">File</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Size</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Uploaded By</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Visible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                    >
                      {ICON_MAP[getIconType(file.mimeType)]}
                      <span className="font-medium text-ink-primary">{file.name}</span>
                    </a>
                  </td>
                  <td className="px-5 py-4 text-ink-muted">{file.size ? formatBytes(file.size) : "—"}</td>
                  <td className="px-5 py-4 text-ink-secondary">{file.uploadedBy.name}</td>
                  <td className="px-5 py-4 text-ink-secondary">{formatDate(file.createdAt)}</td>
                  <td className="px-5 py-4">
                    {file.isClientVisible ? (
                      <span className="text-green-700 text-xs font-medium">Client visible</span>
                    ) : (
                      <span className="text-ink-muted text-xs">Internal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-12 text-center">
          <FileIcon className="mx-auto h-8 w-8 text-ink-muted mb-3" />
          <p className="text-sm font-medium text-ink-primary">No files yet</p>
          <p className="text-xs text-ink-muted mt-1">Upload files to this client</p>
        </div>
      )}
    </div>
  );
}
