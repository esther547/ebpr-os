"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableWrap, Table, Th, Td, TableEmpty } from "@/components/ui/table";

export type StrategistGoal = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  typeLabel: string;
  dateLabel: string;
};

export type StrategistRow = {
  /** User id, or "none" for goals without a closer. */
  key: string;
  name: string;
  initials: string;
  unassigned?: boolean;
  count: number;
  clients: number;
  byType: { label: string; count: number }[];
  goals: StrategistGoal[];
};

export function StrategistGoalsTable({ rows }: { rows: StrategistRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Estratega</Th>
            <Th align="right">Metas cerradas</Th>
            <Th align="right">Clientes</Th>
            <Th>Por tipo</Th>
            <Th align="right">
              <span className="sr-only">Detalle</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = open.has(row.key);
            return (
              <Fragment key={row.key}>
                <tr>
                  <Td>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1 ring-inset",
                          row.unassigned
                            ? "bg-surface-2 text-ink-muted ring-border"
                            : row.count > 0
                              ? "bg-accent2-soft text-accent2-ink ring-accent2/20"
                              : "bg-surface-2 text-ink-secondary ring-border"
                        )}
                        aria-hidden
                      >
                        {row.initials}
                      </span>
                      <div className="min-w-0">
                        <p className={cn("truncate font-medium", row.unassigned ? "text-ink-secondary" : "text-ink-primary")}>
                          {row.name}
                        </p>
                        {row.unassigned && (
                          <p className="text-xs text-ink-muted">
                            Abre la meta y usa “Asignar estratega” para indicar quién la cerró.
                          </p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td align="right" numeric className={cn("text-base font-semibold", row.count === 0 && "text-ink-muted")}>
                    {row.count}
                  </Td>
                  <Td align="right" numeric className="text-ink-secondary">
                    {row.clients}
                  </Td>
                  <Td>
                    {row.byType.length === 0 ? (
                      <span className="text-xs text-ink-muted">&mdash;</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.byType.map((t) => (
                          <Badge key={t.label} size="xs">
                            {t.label}: {t.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    {row.count > 0 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => toggle(row.key)}
                        aria-expanded={expanded}
                        rightIcon={
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                        }
                      >
                        {expanded ? "Ocultar" : "Ver"}
                      </Button>
                    )}
                  </Td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={5} className="!bg-surface-1 !px-4 !py-3">
                      <ul className="divide-y divide-border rounded-lg border border-border bg-white">
                        {row.goals.map((g) => (
                          <li key={g.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                            <span className="w-28 shrink-0 truncate text-xs font-medium text-ink-secondary">
                              {g.clientName}
                            </span>
                            <Link
                              href={`/clients/${g.clientId}/deliverables/${g.id}`}
                              className="min-w-0 flex-1 text-ink-primary underline-offset-2 hover:underline"
                            >
                              {g.title}
                            </Link>
                            <Badge size="xs">{g.typeLabel}</Badge>
                            <span className="tabular text-xs text-ink-muted">{g.dateLabel}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && <TableEmpty colSpan={5}>No hay estrategas activos.</TableEmpty>}
        </tbody>
      </Table>
    </TableWrap>
  );
}
