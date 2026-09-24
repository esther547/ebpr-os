// Unit test of the contact finder's pure pieces (no DB, no API key):
//   npx tsx scripts/test-contact-finder-parser.ts
// Fixture: a Messages API response with web search blocks (success + error)
// and a final text block that ends with the ```json fence.

import assert from "node:assert/strict";
import {
  ContactFinderParseError,
  collectSearchSources,
  extractJsonFence,
  formatContactNotes,
  parseContactFinderContent,
  parseContactFinderJson,
  type ContentBlockLike,
  type InternalContact,
} from "../lib/contact-finder-format";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const finalJson = {
  candidates: [
    {
      name: "Ana Gómez",
      role: "Productora de segmento",
      organization: "Despierta América (Univision)",
      channel: "correo",
      handle: "prensa@univision.net",
      sourceUrl: "https://corporate.univision.com/press/contacts",
      confidence: "high",
      howToApproach: "Enviar un pitch corto con el lanzamiento y fechas en Miami.",
      extraField: "ignored",
    },
    {
      name: null,
      role: "Formulario de solicitudes de medios",
      organization: "Premios Juventud",
      channel: "form",
      sourceUrl: "https://example.org/premios-juventud/prensa",
      confidence: "media",
      howToApproach: "Pedir acreditación como talento invitado.",
    },
    { name: null, role: null, organization: null, handle: null, channel: "other" },
    { name: "Sin fuente", role: "Editor", organization: "Revista X", channel: "carrier pigeon", confidence: "?" },
  ],
  summary: "La ruta más directa es la productora de segmento.",
  caveats: "No se confirmó el correo directo de la productora.",
  unknownTopLevel: true,
};

const fixture: ContentBlockLike[] = [
  { type: "thinking", text: undefined },
  { type: "text", text: "Voy a buscar quién produce el programa." },
  { type: "server_tool_use" },
  {
    type: "web_search_tool_result",
    content: [
      { type: "web_search_result", url: "https://corporate.univision.com/press/contacts", title: "Univision Press", encrypted_content: "x", page_age: null },
      { type: "web_search_result", url: "https://www.linkedin.com/in/ana-gomez", title: "Ana Gómez", encrypted_content: "x", page_age: null },
    ],
  },
  { type: "server_tool_use" },
  // Error results are an object, not a list — must be skipped.
  { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
  {
    type: "web_search_tool_result",
    content: [{ type: "web_search_result", url: "https://corporate.univision.com/press/contacts", title: "dup", encrypted_content: "x", page_age: null }],
  },
  { type: "text", text: "Encontré estos contactos.\n\n```json\n" + JSON.stringify(finalJson, null, 2) + "\n```" },
];

test("parses the last text block's json fence (tolerant fields)", () => {
  const r = parseContactFinderContent(fixture);
  assert.equal(r.candidates.length, 3, "empty candidate dropped");
  const [a, b, c] = r.candidates;
  assert.equal(a.name, "Ana Gómez");
  assert.equal(a.channel, "email", "correo -> email");
  assert.equal(a.confidence, "alta", "high -> alta");
  assert.equal(a.handle, "prensa@univision.net");
  assert.ok(!("extraField" in a), "unknown fields ignored");
  assert.equal(b.name, null);
  assert.equal(b.handle, null, "missing handle -> null");
  assert.equal(b.channel, "form");
  assert.equal(c.channel, "other", "unknown channel -> other");
  assert.equal(c.confidence, "baja", "unknown confidence -> baja");
  assert.equal(c.sourceUrl, null);
  assert.equal(r.summary, "La ruta más directa es la productora de segmento.");
  assert.equal(r.caveats, "No se confirmó el correo directo de la productora.");
});

test("joins text blocks when citations split the json fence", () => {
  const whole = "Listo.\n```json\n" + JSON.stringify(finalJson) + "\n```";
  const cut = whole.indexOf("Productora");
  const split: ContentBlockLike[] = [
    { type: "web_search_tool_result", content: [] },
    { type: "text", text: whole.slice(0, cut) },
    { type: "text", text: whole.slice(cut, cut + 25) }, // a cited span
    { type: "text", text: whole.slice(cut + 25) },
  ];
  const r = parseContactFinderContent(split);
  assert.equal(r.candidates[0].role, "Productora de segmento");
  assert.equal(r.candidates.length, 3);
});

test("uses the LAST json fence when there are several", () => {
  const text = '```json\n{"candidates":[{"name":"Viejo","role":"x"}]}\n```\nCorrijo:\n```json\n{"candidates":[{"name":"Nuevo","role":"y"}],"summary":"s"}\n```';
  assert.equal(parseContactFinderJson(text).candidates[0].name, "Nuevo");
});

test("missing arrays -> [] and missing strings -> null", () => {
  const r = parseContactFinderJson('```json\n{"summary":"Nada específico; usar prensa@evento.com"}\n```');
  assert.deepEqual(r.candidates, []);
  assert.equal(r.caveats, null);
  const r2 = parseContactFinderJson('```json\n{"candidates":"no es lista"}\n```');
  assert.deepEqual(r2.candidates, []);
});

test("unfenced JSON object is still accepted", () => {
  assert.equal(extractJsonFence('Resultado: {"candidates":[]} fin'), '{"candidates":[]}');
});

test("no JSON / invalid JSON / no text -> ContactFinderParseError", () => {
  assert.throws(() => parseContactFinderJson("No encontré nada."), ContactFinderParseError);
  assert.throws(() => parseContactFinderJson("```json\n{candidates: [}\n```"), ContactFinderParseError);
  assert.throws(() => parseContactFinderJson("```json\n[1,2]\n```"), ContactFinderParseError);
  assert.throws(() => parseContactFinderContent([{ type: "web_search_tool_result", content: [] }]), ContactFinderParseError);
});

test("collects web_search_result urls (deduped, error results skipped)", () => {
  const sources = collectSearchSources(fixture);
  assert.deepEqual(
    sources.map((s) => s.url),
    ["https://corporate.univision.com/press/contacts", "https://www.linkedin.com/in/ana-gomez"]
  );
});

const internal: InternalContact[] = [
  { id: "j1", name: "Laura Ríos", outlet: "Despierta América", beat: "Entretenimiento", email: "laura@example.com", phone: "+1 305 555 0100", city: "Miami" },
];

test("formats contactNotes in Spanish", () => {
  const r = parseContactFinderContent(fixture);
  const notes = formatContactNotes(internal, r, collectSearchSources(fixture));
  assert.ok(notes.startsWith("Contactos internos:\n- Laura Ríos — Despierta América · Entretenimiento · laura@example.com · +1 305 555 0100 · Miami"));
  assert.ok(notes.includes("Posibles contactos:\n1. Ana Gómez — Productora de segmento, Despierta América (Univision) · email: prensa@univision.net · confianza alta"));
  assert.ok(notes.includes("   Cómo abordar: Enviar un pitch corto"));
  assert.ok(notes.includes("   Fuente: https://corporate.univision.com/press/contacts"));
  assert.ok(notes.includes("2. Canal oficial — Formulario de solicitudes de medios, Premios Juventud · formulario: — · confianza media"));
  assert.ok(notes.includes("Resumen: La ruta más directa"));
  assert.ok(!notes.includes("Fuentes consultadas:"), "candidates already cite sources");
  assert.ok(notes.endsWith("Verificar antes de contactar."));
  console.log("\n" + notes + "\n");
});

test("no candidates -> says so and lists fallback sources", () => {
  const notes = formatContactNotes([], { candidates: [], summary: "Usar el formulario oficial.", caveats: null }, [
    { url: "https://example.org/prensa", title: null },
  ]);
  assert.ok(!notes.includes("Contactos internos:"));
  assert.ok(notes.includes("Posibles contactos:\nNo se encontró un contacto específico."));
  assert.ok(notes.includes("Fuentes consultadas:\n- https://example.org/prensa"));
  assert.ok(notes.endsWith("Verificar antes de contactar."));
});

console.log(`\n${passed} tests passed`);
