import { cn } from "@/lib/utils";

/**
 * Data table primitives. Use inside a Card with padding="none":
 *   <TableWrap><Table><thead>…</thead><tbody>…</tbody></Table></TableWrap>
 * Header/row styling comes from the `.ebpr-table` rules in globals.css.
 */
export function TableWrap({ children, className, maxHeight }: { children: React.ReactNode; className?: string; maxHeight?: string }) {
  return (
    <div className={cn("overflow-auto rounded-xl border border-border bg-white shadow-card", className)} style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

export function Table({ children, className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("ebpr-table w-full min-w-[640px] border-collapse text-left", className)} {...props}>
      {children}
    </table>
  );
}

export function Th({ children, className, align, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th className={cn(align === "right" && "!text-right", align === "center" && "!text-center", className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className, align, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center"; numeric?: boolean }) {
  return (
    <td className={cn(align === "right" && "text-right", align === "center" && "text-center", numeric && "tabular", className)} {...props}>
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!py-12 text-center text-sm text-ink-muted">
        {children}
      </td>
    </tr>
  );
}
