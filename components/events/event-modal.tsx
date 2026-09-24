"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Button,
  FormActions,
  FormGroup,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-field";
import {
  CATEGORY_LABEL,
  DEFAULT_LEAD_DAYS,
  EVENT_CATEGORIES,
  MONTHS_ES,
  type EventCategoryValue,
  type UpcomingEventItem,
} from "./helpers";

export type EventDraft = {
  name: string;
  category: EventCategoryValue;
  month: number;
  day: number | null;
  year: number | null;
  city: string | null;
  notes: string | null;
  url: string | null;
  leadDays: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when creating a new event. */
  item: UpcomingEventItem | null;
  /** Current Miami month (1-12), preselected for a new event. */
  defaultMonth: number;
  onSubmit: (draft: EventDraft) => Promise<boolean>;
};

const intOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function EventModal({ open, onOpenChange, item, defaultMonth, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EventCategoryValue>("OTHER");
  const [month, setMonth] = useState(String(defaultMonth));
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [leadDays, setLeadDays] = useState(String(DEFAULT_LEAD_DAYS));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setCategory(item?.category ?? "OTHER");
    setMonth(String(item?.month ?? defaultMonth));
    setDay(item?.day != null ? String(item.day) : "");
    setYear(item?.year != null ? String(item.year) : "");
    setCity(item?.city ?? "");
    setNotes(item?.notes ?? "");
    setUrl(item?.url ?? "");
    setLeadDays(String(item?.leadDays ?? DEFAULT_LEAD_DAYS));
    setSaving(false);
  }, [open, item, defaultMonth]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const ok = await onSubmit({
        name: name.trim(),
        category,
        month: Number(month),
        day: intOrNull(day),
        year: intOrNull(year),
        city: city.trim() || null,
        notes: notes.trim() || null,
        url: url.trim() || null,
        leadDays: Number(leadDays || DEFAULT_LEAD_DAYS),
      });
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Editar evento" : "Nuevo evento"}
      description={item ? undefined : "Te avisamos con tiempo para trabajar la oportunidad."}
    >
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Nombre" htmlFor="event-name" required>
          <Input
            id="event-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="amfAR Gala"
            maxLength={200}
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Categoría" htmlFor="event-category">
          <Select
            id="event-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategoryValue)}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </FormGroup>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Mes" htmlFor="event-month" required>
            <Select id="event-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS_ES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Día" htmlFor="event-day" hint="opcional">
            <Input
              id="event-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Todo el mes"
            />
          </FormGroup>
          <FormGroup
            label="Año"
            htmlFor="event-year"
            hint="opcional"
            description={year.trim() === "" ? "Se repite cada año" : "Solo ese año"}
          >
            <Input
              id="event-year"
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Cada año"
            />
          </FormGroup>
        </div>

        <FormGroup label="Ciudad" htmlFor="event-city">
          <Input
            id="event-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Cannes"
            maxLength={120}
          />
        </FormGroup>

        <FormGroup label="Notas" htmlFor="event-notes">
          <Textarea
            id="event-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional — fechas aproximadas, contactos, qué clientes encajan…"
          />
        </FormGroup>

        <FormGroup label="Link" htmlFor="event-url">
          <Input
            id="event-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </FormGroup>

        <FormGroup
          label="Avisar con N días de anticipación"
          htmlFor="event-lead"
          description="Entre 7 y 365 días. Por defecto, 60 (unos 2 meses)."
        >
          <Input
            id="event-lead"
            type="number"
            inputMode="numeric"
            min={7}
            max={365}
            value={leadDays}
            onChange={(e) => setLeadDays(e.target.value)}
          />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            {item ? "Guardar" : "Agregar"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
