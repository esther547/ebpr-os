import { redirect } from "next/navigation";

/** The journalist database now lives under Contactos → Medios. */
export default function JournalistsRedirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => !!e[1])).toString();
  redirect(`/contactos/medios${qs ? `?${qs}` : ""}`);
}
