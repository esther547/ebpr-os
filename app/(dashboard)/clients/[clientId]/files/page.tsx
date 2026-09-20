import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatBytes } from "@/lib/utils";
import { FileText, Image, Table as TableIcon, Video, File as FileIcon } from "lucide-react";
import { FileUpload } from "@/components/clients/file-upload";
import { ClientHeader } from "@/components/clients/client-header";
import { TableWrap, Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";

type Props = { params: { clientId: string } };

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

const ICON_MAP: Record<string, React.ReactNode> = {
  image: <Image className="h-4 w-4 text-ink-muted" />,
  "file-text": <FileText className="h-4 w-4 text-ink-muted" />,
  table: <TableIcon className="h-4 w-4 text-ink-muted" />,
  video: <Video className="h-4 w-4 text-ink-muted" />,
  file: <FileIcon className="h-4 w-4 text-ink-muted" />,
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
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true },
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
    <>
      <ClientHeader client={client} counts={{ files: files.length }} />

      <div className="space-y-6">
        <FileUpload clientId={client.id} />

        <section>
          <SectionHeader title={`Files (${files.length})`} />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>Size</Th>
                  <Th>Uploaded By</Th>
                  <Th>Date</Th>
                  <Th>Visibility</Th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    No files yet — use the upload area above to add contracts, assets, or coverage.
                  </TableEmpty>
                ) : (
                  files.map((file) => (
                    <tr key={file.id}>
                      <Td>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 transition-colors hover:text-ink-primary"
                        >
                          {ICON_MAP[getIconType(file.mimeType)]}
                          <span className="font-medium text-ink-primary underline-offset-4 hover:underline">
                            {file.name}
                          </span>
                        </a>
                      </Td>
                      <Td numeric className="text-ink-muted">
                        {file.size ? formatBytes(file.size) : "—"}
                      </Td>
                      <Td className="text-ink-secondary">{file.uploadedBy.name}</Td>
                      <Td className="text-ink-secondary">{formatDate(file.createdAt)}</Td>
                      <Td>
                        <Badge size="xs" tone={file.isClientVisible ? "success" : "neutral"}>
                          {file.isClientVisible ? "Client visible" : "Internal"}
                        </Badge>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </section>
      </div>
    </>
  );
}
