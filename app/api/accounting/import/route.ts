import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── ACCOUNTING DATA FROM ESTHER'S MASTER SPREADSHEET (April 2026) ────────

type ClientData = {
  name: string;
  contractStatus: "SIGNED" | "SENT" | "DRAFT" | "NONE";
  contractEnd: string | null; // "Month to Month" or date string
  monthlyAmount: number;
  billTo: string | null;
  billEmails: string[];
  notes: string | null;
  invoices: {
    month: number; // 1-12
    year: number;
    amount: number;
    invoiceDate: string; // ISO date when invoice is created
    dueDate: string; // ISO date when payment is due
    sentDate: string | null;
    paidDate: string | null;
    status: "PAID" | "SENT" | "DRAFT" | "OVERDUE";
    notes: string | null;
  }[];
  contractStartDate: string | null;
  contractEndDate: string | null;
};

const today = new Date("2026-04-08");

function d(dateStr: string): string {
  return new Date(dateStr).toISOString();
}

function invoiceStatus(dueDate: string, sentDate: string | null, paidDate: string | null): "PAID" | "SENT" | "DRAFT" | "OVERDUE" {
  if (paidDate) return "PAID";
  const due = new Date(dueDate);
  if (sentDate) {
    return due < today ? "OVERDUE" : "SENT";
  }
  return due < today ? "OVERDUE" : "DRAFT";
}

const CLIENTS: ClientData[] = [
  // ─── 1. HECTOR BENITEZ ───────────────────────
  {
    name: "Hector Benitez",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month",
    monthlyAmount: 4000,
    billTo: "Hector Benitez",
    billEmails: ["hector.benme@gmail.com", "administracion@benmelegal.org"],
    notes: "Pays at the end of the month",
    contractStartDate: "2025-12-25",
    contractEndDate: null,
    invoices: [
      { month: 12, year: 2025, amount: 4000, invoiceDate: "2025-12-25", dueDate: "2025-12-31", sentDate: null, paidDate: "2026-01-05", status: "PAID", notes: "Paid Jan 5" },
      { month: 1, year: 2026, amount: 4000, invoiceDate: "2026-01-25", dueDate: "2026-01-31", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 4000, invoiceDate: "2026-02-25", dueDate: "2026-02-28", sentDate: null, paidDate: "2026-02-26", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 4000, invoiceDate: "2026-03-25", dueDate: "2026-03-31", sentDate: "2026-03-23", paidDate: "2026-03-23", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 4000, invoiceDate: "2026-04-25", dueDate: "2026-04-30", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4000, invoiceDate: "2026-05-25", dueDate: "2026-05-31", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4000, invoiceDate: "2026-06-25", dueDate: "2026-06-30", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4000, invoiceDate: "2026-07-25", dueDate: "2026-07-31", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4000, invoiceDate: "2026-08-25", dueDate: "2026-08-31", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4000, invoiceDate: "2026-09-25", dueDate: "2026-09-30", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4000, invoiceDate: "2026-10-25", dueDate: "2026-10-31", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 4000, invoiceDate: "2026-11-25", dueDate: "2026-11-30", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 4000, invoiceDate: "2026-12-25", dueDate: "2026-12-31", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 2. BETA MEJIA ───────────────────────────
  {
    name: "Beta Mejia",
    contractStatus: "NONE",
    contractEnd: "Month to Month",
    monthlyAmount: 3000,
    billTo: "Beta Mejia",
    billEmails: [],
    notes: "No contract needed",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 12, year: 2025, amount: 3000, invoiceDate: "2025-12-10", dueDate: "2025-12-15", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 3000, invoiceDate: "2026-04-01", dueDate: "2026-04-01", sentDate: "2026-03-30", paidDate: null, status: "SENT", notes: null },
      { month: 5, year: 2026, amount: 3000, invoiceDate: "2026-05-10", dueDate: "2026-05-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3000, invoiceDate: "2026-06-10", dueDate: "2026-06-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3000, invoiceDate: "2026-07-10", dueDate: "2026-07-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3000, invoiceDate: "2026-08-10", dueDate: "2026-08-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 3. MARKO ────────────────────────────────
  {
    name: "Marko",
    contractStatus: "NONE",
    contractEnd: "Month to Month",
    monthlyAmount: 3500,
    billTo: "MARKO MUSICA, LLC",
    billEmails: ["admin@markoenweb.com"],
    notes: "No contract needed",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 1, year: 2026, amount: 3500, invoiceDate: "2026-01-15", dueDate: "2026-01-19", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 3500, invoiceDate: "2026-02-15", dueDate: "2026-02-19", sentDate: null, paidDate: "2026-02-23", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 3500, invoiceDate: "2026-03-15", dueDate: "2026-03-19", sentDate: "2026-03-13", paidDate: "2026-03-16", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 3500, invoiceDate: "2026-04-15", dueDate: "2026-04-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 3500, invoiceDate: "2026-05-15", dueDate: "2026-05-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3500, invoiceDate: "2026-06-15", dueDate: "2026-06-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3500, invoiceDate: "2026-07-15", dueDate: "2026-07-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3500, invoiceDate: "2026-08-15", dueDate: "2026-08-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 3500, invoiceDate: "2026-09-15", dueDate: "2026-09-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 3500, invoiceDate: "2026-10-15", dueDate: "2026-10-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 3500, invoiceDate: "2026-11-15", dueDate: "2026-11-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 3500, invoiceDate: "2026-12-15", dueDate: "2026-12-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 4. LELE PONS ────────────────────────────
  {
    name: "Lele Pons",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month",
    monthlyAmount: 5000,
    billTo: "LELE PONS, LLC",
    billEmails: ["aramos@amidawealth.com"],
    notes: "Travel expenses: Paris viaticos $783, Flight NYC iHeart $182.83",
    contractStartDate: "2025-12-20",
    contractEndDate: null,
    invoices: [
      { month: 12, year: 2025, amount: 5000, invoiceDate: "2025-12-20", dueDate: "2025-12-22", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 1, year: 2026, amount: 5000, invoiceDate: "2026-01-20", dueDate: "2026-01-22", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 5000, invoiceDate: "2026-02-20", dueDate: "2026-02-22", sentDate: null, paidDate: "2026-03-02", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 5000, invoiceDate: "2026-03-20", dueDate: "2026-03-22", sentDate: "2026-03-23", paidDate: null, status: "OVERDUE", notes: null },
      { month: 4, year: 2026, amount: 5000, invoiceDate: "2026-04-20", dueDate: "2026-04-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 5000, invoiceDate: "2026-05-20", dueDate: "2026-05-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 5000, invoiceDate: "2026-06-20", dueDate: "2026-06-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 5000, invoiceDate: "2026-07-20", dueDate: "2026-07-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 5000, invoiceDate: "2026-08-20", dueDate: "2026-08-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 5000, invoiceDate: "2026-09-20", dueDate: "2026-09-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 5000, invoiceDate: "2026-10-20", dueDate: "2026-10-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 5000, invoiceDate: "2026-11-20", dueDate: "2026-11-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 5000, invoiceDate: "2026-12-20", dueDate: "2026-12-22", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 5. PERRO NEGRO ──────────────────────────
  {
    name: "Perro Negro",
    contractStatus: "SIGNED",
    contractEnd: "January 5, 2027",
    monthlyAmount: 2000,
    billTo: "Simon Piedrahita",
    billEmails: ["gerencia@thehacienda.com.co", "accounting@perronegromiami.com"],
    notes: null,
    contractStartDate: "2026-01-05",
    contractEndDate: "2027-01-05",
    invoices: [
      { month: 1, year: 2026, amount: 2000, invoiceDate: "2026-01-15", dueDate: "2026-01-19", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 2000, invoiceDate: "2026-02-15", dueDate: "2026-02-19", sentDate: null, paidDate: "2026-02-19", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 3800, invoiceDate: "2026-03-15", dueDate: "2026-03-19", sentDate: "2026-03-13", paidDate: null, status: "OVERDUE", notes: "$2,000 + $600 Bad Bunny + $600 Esquire + $600 Ballers League" },
      { month: 4, year: 2026, amount: 2600, invoiceDate: "2026-04-15", dueDate: "2026-04-19", sentDate: null, paidDate: null, status: "DRAFT", notes: "$2,000 + $600 FIFA" },
      { month: 5, year: 2026, amount: 2000, invoiceDate: "2026-05-15", dueDate: "2026-05-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 2000, invoiceDate: "2026-06-15", dueDate: "2026-06-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 2000, invoiceDate: "2026-07-15", dueDate: "2026-07-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 2000, invoiceDate: "2026-08-15", dueDate: "2026-08-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 2000, invoiceDate: "2026-09-15", dueDate: "2026-09-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 2000, invoiceDate: "2026-10-15", dueDate: "2026-10-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 2000, invoiceDate: "2026-11-15", dueDate: "2026-11-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 2000, invoiceDate: "2026-12-15", dueDate: "2026-12-19", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 6. GUAYNAA ──────────────────────────────
  {
    name: "Guaynaa",
    contractStatus: "SIGNED",
    contractEnd: "May 17, 2026",
    monthlyAmount: 3000,
    billTo: "GUAYNAA ENTERTAINMENT, LLC",
    billEmails: ["Contactguaynaa@gmail.com", "Guaynaapayments@gmail.com", "Rweihe@bomapr.com"],
    notes: "Urb. Ciudad Jardin de Canovanas, A-24 Calle Alcanfor, Canovanas PR 00729. Send invoice to all emails. Gastos PR y NY Juanita + labels vinos $272.47",
    contractStartDate: "2025-08-18",
    contractEndDate: "2026-05-17",
    invoices: [
      { month: 10, year: 2025, amount: 4000, invoiceDate: "2025-10-01", dueDate: "2025-10-01", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 11, year: 2025, amount: 3000, invoiceDate: "2025-11-12", dueDate: "2025-11-17", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 12, year: 2025, amount: 3000, invoiceDate: "2025-12-12", dueDate: "2025-12-17", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 1, year: 2026, amount: 3000, invoiceDate: "2026-01-12", dueDate: "2026-01-17", sentDate: "2026-01-07", paidDate: "2026-01-07", status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 3000, invoiceDate: "2026-02-12", dueDate: "2026-02-17", sentDate: "2026-02-06", paidDate: null, status: "OVERDUE", notes: null },
      { month: 3, year: 2026, amount: 3000, invoiceDate: "2026-03-12", dueDate: "2026-03-17", sentDate: "2026-03-30", paidDate: "2026-03-02", status: "PAID", notes: "Send invoice with month of service. Resent 3-30" },
      { month: 4, year: 2026, amount: 3000, invoiceDate: "2026-04-11", dueDate: "2026-04-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 7. DELFINA SAUD ─────────────────────────
  {
    name: "Delfina Saud",
    contractStatus: "SIGNED",
    contractEnd: "January 5, 2027",
    monthlyAmount: 3500,
    billTo: "Delfina Saud",
    billEmails: ["sauddelfi@gmail.com"],
    notes: null,
    contractStartDate: "2026-01-05",
    contractEndDate: "2027-01-05",
    invoices: [
      { month: 1, year: 2026, amount: 3500, invoiceDate: "2026-01-05", dueDate: "2026-01-05", sentDate: null, paidDate: null, status: "PAID", notes: "Deposit" },
      { month: 2, year: 2026, amount: 1500, invoiceDate: "2026-02-01", dueDate: "2026-02-05", sentDate: null, paidDate: null, status: "PAID", notes: "Partial month" },
      { month: 3, year: 2026, amount: 3500, invoiceDate: "2026-03-01", dueDate: "2026-03-05", sentDate: "2026-02-27", paidDate: "2026-03-09", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 3500, invoiceDate: "2026-04-01", dueDate: "2026-04-05", sentDate: "2026-03-30", paidDate: "2026-04-02", status: "PAID", notes: null },
      { month: 5, year: 2026, amount: 3500, invoiceDate: "2026-05-01", dueDate: "2026-05-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3500, invoiceDate: "2026-06-01", dueDate: "2026-06-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3500, invoiceDate: "2026-07-01", dueDate: "2026-07-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3500, invoiceDate: "2026-08-01", dueDate: "2026-08-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 3500, invoiceDate: "2026-09-01", dueDate: "2026-09-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 3500, invoiceDate: "2026-10-01", dueDate: "2026-10-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 3500, invoiceDate: "2026-11-01", dueDate: "2026-11-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 3500, invoiceDate: "2026-12-01", dueDate: "2026-12-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 8. ANDRES GONZALEZ / CASA D / ROSARIO ───
  {
    name: "Andres Gonzalez / Casa D / Rosario",
    contractStatus: "SIGNED",
    contractEnd: "January 31, 2027",
    monthlyAmount: 3000,
    billTo: "Rosario Wynwood Corp.",
    billEmails: ["Treasury@monarkhospitality.com"],
    notes: "Invoice should include: Issued to Rosario Wynwood Corp, Date of service, Description: PR Services, Amount due, EBPR name/address, Invoice number",
    contractStartDate: "2026-02-01",
    contractEndDate: "2027-01-31",
    invoices: [
      { month: 2, year: 2026, amount: 3000, invoiceDate: "2026-02-25", dueDate: "2026-03-01", sentDate: "2026-02-25", paidDate: "2026-03-02", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 3000, invoiceDate: "2026-03-25", dueDate: "2026-04-01", sentDate: "2026-03-23", paidDate: "2026-03-25", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 3000, invoiceDate: "2026-04-25", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 3000, invoiceDate: "2026-05-25", dueDate: "2026-06-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3000, invoiceDate: "2026-06-25", dueDate: "2026-07-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3000, invoiceDate: "2026-07-25", dueDate: "2026-08-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3000, invoiceDate: "2026-08-25", dueDate: "2026-09-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 3000, invoiceDate: "2026-09-25", dueDate: "2026-10-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 3000, invoiceDate: "2026-10-25", dueDate: "2026-11-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 9. ANA ESTELA CISNEROS SIMG ─────────────
  {
    name: "Ana Estela Cisneros SIMG",
    contractStatus: "SIGNED",
    contractEnd: "June 3, 2026",
    monthlyAmount: 3600,
    billTo: "Ana Estela Cisneros SIMG",
    billEmails: ["anasimg@hotmail.com", "anacsimg99@gmail.com"],
    notes: "Juanita viaticos NYC $243.03",
    contractStartDate: "2025-11-30",
    contractEndDate: "2026-06-03",
    invoices: [
      { month: 11, year: 2025, amount: 3600, invoiceDate: "2025-11-30", dueDate: "2025-12-03", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 12, year: 2025, amount: 3600, invoiceDate: "2025-12-30", dueDate: "2026-01-03", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 1, year: 2026, amount: 3600, invoiceDate: "2026-01-30", dueDate: "2026-02-03", sentDate: null, paidDate: "2026-02-05", status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 3600, invoiceDate: "2026-02-27", dueDate: "2026-03-03", sentDate: "2026-02-27", paidDate: "2026-03-04", status: "PAID", notes: "$2500 on 3/4, $1000 separate" },
      { month: 3, year: 2026, amount: 3600, invoiceDate: "2026-03-30", dueDate: "2026-04-03", sentDate: "2026-03-30", paidDate: "2026-03-30", status: "PAID", notes: "$3,600 paid 3/30" },
      { month: 4, year: 2026, amount: 3600, invoiceDate: "2026-04-30", dueDate: "2026-05-03", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 10. SKY KINGS MUSIC (SENZIONE) ──────────
  {
    name: "Sky Kings Music / Senzione",
    contractStatus: "SIGNED",
    contractEnd: "April 3, 2026 (delayed 1 month)",
    monthlyAmount: 5000,
    billTo: "SKY KINGS MUSIC, LLC",
    billEmails: ["info@skykingsmusic.com", "serpa@amazonaviationus.com"],
    notes: "Original end March 3 2026, delayed 1 month to April. RENEWAL SENT / WAITING ON SIGNATURE",
    contractStartDate: "2025-12-01",
    contractEndDate: "2026-04-03",
    invoices: [
      { month: 12, year: 2025, amount: 5000, invoiceDate: "2025-12-01", dueDate: "2025-12-03", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 5000, invoiceDate: "2026-02-01", dueDate: "2026-02-03", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 5040, invoiceDate: "2026-03-01", dueDate: "2026-03-03", sentDate: null, paidDate: "2026-03-16", status: "PAID", notes: null },
      { month: 5, year: 2026, amount: 5000, invoiceDate: "2026-05-01", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: "Renewal pending" },
      { month: 6, year: 2026, amount: 5000, invoiceDate: "2026-06-01", dueDate: "2026-06-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 5000, invoiceDate: "2026-07-01", dueDate: "2026-07-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 5000, invoiceDate: "2026-08-01", dueDate: "2026-08-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 11. JUAN DE MONTREAL ────────────────────
  {
    name: "Juan de Montreal",
    contractStatus: "SENT",
    contractEnd: "Month to Month",
    monthlyAmount: 4000,
    billTo: "Juan de Montreal",
    billEmails: ["juandemontreal@gmail.com"],
    notes: "Sent / Waiting on Signature",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 2, year: 2026, amount: 4000, invoiceDate: "2026-02-25", dueDate: "2026-02-28", sentDate: "2026-02-25", paidDate: null, status: "OVERDUE", notes: null },
      { month: 3, year: 2026, amount: 4000, invoiceDate: "2026-03-25", dueDate: "2026-03-30", sentDate: "2026-03-23", paidDate: null, status: "OVERDUE", notes: null },
    ],
  },

  // ─── 12. DANIELA FERNANDEZ ───────────────────
  {
    name: "Daniela Fernandez",
    contractStatus: "SIGNED",
    contractEnd: "Renewal",
    monthlyAmount: 4500,
    billTo: "Daniela Fernandez",
    billEmails: ["Danifernazer@gmail.com"],
    notes: "Renewal",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 2, year: 2026, amount: 4500, invoiceDate: "2026-02-01", dueDate: "2026-02-01", sentDate: null, paidDate: "2026-02-16", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 4500, invoiceDate: "2026-03-01", dueDate: "2026-03-01", sentDate: "2026-02-27", paidDate: null, status: "OVERDUE", notes: null },
      { month: 4, year: 2026, amount: 4500, invoiceDate: "2026-04-01", dueDate: "2026-04-01", sentDate: "2026-03-30", paidDate: null, status: "SENT", notes: "Renewal" },
    ],
  },

  // ─── 13. CAMILA GUIRIBITEY ───────────────────
  {
    name: "Camila Guiribitey",
    contractStatus: "SENT",
    contractEnd: "Month to Month",
    monthlyAmount: 4200,
    billTo: "Camila Guiribitey",
    billEmails: ["cjgi1012@gmail.com", "dagmara@cgcamile.com"],
    notes: "Sent / Waiting on Signature. RESEND BOTH EMAILS + 3%",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 12, year: 2025, amount: 4700, invoiceDate: "2025-12-05", dueDate: "2025-12-05", sentDate: null, paidDate: null, status: "PAID", notes: "Initial deposit" },
      { month: 2, year: 2026, amount: 4200, invoiceDate: "2026-02-01", dueDate: "2026-02-05", sentDate: null, paidDate: null, status: "OVERDUE", notes: null },
      { month: 3, year: 2026, amount: 4200, invoiceDate: "2026-03-01", dueDate: "2026-03-05", sentDate: "2026-03-09", paidDate: null, status: "OVERDUE", notes: "Sent 2/27 and 3/9" },
      { month: 4, year: 2026, amount: 4200, invoiceDate: "2026-04-01", dueDate: "2026-04-05", sentDate: null, paidDate: null, status: "DRAFT", notes: "RESEND + 3%" },
      { month: 5, year: 2026, amount: 4200, invoiceDate: "2026-05-01", dueDate: "2026-05-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4200, invoiceDate: "2026-06-01", dueDate: "2026-06-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4200, invoiceDate: "2026-07-01", dueDate: "2026-07-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4200, invoiceDate: "2026-08-01", dueDate: "2026-08-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4200, invoiceDate: "2026-09-01", dueDate: "2026-09-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4200, invoiceDate: "2026-10-01", dueDate: "2026-10-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 14. OSCAR ALEJANDRO ─────────────────────
  {
    name: "Oscar Alejandro",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month",
    monthlyAmount: 4000,
    billTo: "ELOSCARALE INC",
    billEmails: ["oscaralejandro14@gmail.com"],
    notes: "EIN: 81-3326015. Travel Expenses Marcello Hernandez Netflix Premiere Los Angeles $195.42",
    contractStartDate: "2026-01-05",
    contractEndDate: null,
    invoices: [
      { month: 1, year: 2026, amount: 4000, invoiceDate: "2026-01-05", dueDate: "2026-01-05", sentDate: null, paidDate: null, status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 4000, invoiceDate: "2026-02-01", dueDate: "2026-02-05", sentDate: null, paidDate: "2026-02-04", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 4000, invoiceDate: "2026-03-01", dueDate: "2026-03-05", sentDate: "2026-02-27", paidDate: "2026-03-03", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 4000, invoiceDate: "2026-04-01", dueDate: "2026-04-05", sentDate: "2026-03-30", paidDate: "2026-04-07", status: "PAID", notes: null },
      { month: 5, year: 2026, amount: 4000, invoiceDate: "2026-05-01", dueDate: "2026-05-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4000, invoiceDate: "2026-06-01", dueDate: "2026-06-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4000, invoiceDate: "2026-07-01", dueDate: "2026-07-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4000, invoiceDate: "2026-08-01", dueDate: "2026-08-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4000, invoiceDate: "2026-09-01", dueDate: "2026-09-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4000, invoiceDate: "2026-10-01", dueDate: "2026-10-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 4000, invoiceDate: "2026-11-01", dueDate: "2026-11-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 4000, invoiceDate: "2026-12-01", dueDate: "2026-12-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 16. PAO RUIZ ────────────────────────────
  {
    name: "Pao Ruiz",
    contractStatus: "SIGNED",
    contractEnd: "January 31, 2027",
    monthlyAmount: 2500,
    billTo: "Paola Ruiz",
    billEmails: ["paoruizcollab@gmail.com"],
    notes: null,
    contractStartDate: "2025-02-01",
    contractEndDate: "2027-01-31",
    invoices: [
      { month: 1, year: 2026, amount: 2500, invoiceDate: "2026-01-25", dueDate: "2026-02-01", sentDate: null, paidDate: "2026-02-01", status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 2500, invoiceDate: "2026-02-25", dueDate: "2026-03-01", sentDate: "2026-02-25", paidDate: "2026-03-02", status: "PAID", notes: null },
      { month: 3, year: 2026, amount: 2500, invoiceDate: "2026-03-25", dueDate: "2026-04-01", sentDate: "2026-03-23", paidDate: "2026-03-27", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 2500, invoiceDate: "2026-04-25", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 2500, invoiceDate: "2026-05-25", dueDate: "2026-06-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 2500, invoiceDate: "2026-06-25", dueDate: "2026-07-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 2500, invoiceDate: "2026-07-25", dueDate: "2026-08-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 2500, invoiceDate: "2026-08-25", dueDate: "2026-09-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 2500, invoiceDate: "2026-09-25", dueDate: "2026-10-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 2500, invoiceDate: "2026-10-25", dueDate: "2026-11-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 2500, invoiceDate: "2026-11-25", dueDate: "2026-12-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 2500, invoiceDate: "2026-12-25", dueDate: "2027-01-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 17. KARIME PINDTER ──────────────────────
  {
    name: "Karime Pindter",
    contractStatus: "SIGNED",
    contractEnd: "January 11, 2027",
    monthlyAmount: 3500,
    billTo: "Karime Pindter",
    billEmails: [],
    notes: "Please include wire transfer info on invoice",
    contractStartDate: "2026-01-12",
    contractEndDate: "2027-01-11",
    invoices: [
      { month: 1, year: 2026, amount: 3500, invoiceDate: "2026-01-12", dueDate: "2026-01-12", sentDate: null, paidDate: null, status: "PAID", notes: "Deposit" },
      { month: 2, year: 2026, amount: 3500, invoiceDate: "2026-02-07", dueDate: "2026-02-12", sentDate: "2026-02-11", paidDate: null, status: "OVERDUE", notes: "Jessi sent 02/11" },
      { month: 4, year: 2026, amount: 3500, invoiceDate: "2026-04-07", dueDate: "2026-04-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 3500, invoiceDate: "2026-05-07", dueDate: "2026-05-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3500, invoiceDate: "2026-06-07", dueDate: "2026-06-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3500, invoiceDate: "2026-07-07", dueDate: "2026-07-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3500, invoiceDate: "2026-08-07", dueDate: "2026-08-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 3500, invoiceDate: "2026-09-07", dueDate: "2026-09-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 3500, invoiceDate: "2026-10-07", dueDate: "2026-10-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 3500, invoiceDate: "2026-11-07", dueDate: "2026-11-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 3500, invoiceDate: "2026-12-07", dueDate: "2026-12-12", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 18. FER ARIZA ───────────────────────────
  {
    name: "Fer Ariza",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month",
    monthlyAmount: 4500,
    billTo: "Beto Music, S.A.S",
    billEmails: ["managementferariza@gmail.com"],
    notes: null,
    contractStartDate: "2026-01-10",
    contractEndDate: null,
    invoices: [
      { month: 1, year: 2026, amount: 4500, invoiceDate: "2026-01-10", dueDate: "2026-01-15", sentDate: null, paidDate: "2026-02-15", status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 4500, invoiceDate: "2026-02-10", dueDate: "2026-02-15", sentDate: "2026-02-18", paidDate: null, status: "OVERDUE", notes: null },
      { month: 3, year: 2026, amount: 4500, invoiceDate: "2026-03-10", dueDate: "2026-03-15", sentDate: null, paidDate: "2026-03-18", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 4500, invoiceDate: "2026-04-10", dueDate: "2026-04-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-05-10", dueDate: "2026-05-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4500, invoiceDate: "2026-06-10", dueDate: "2026-06-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4500, invoiceDate: "2026-07-10", dueDate: "2026-07-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4500, invoiceDate: "2026-08-10", dueDate: "2026-08-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4500, invoiceDate: "2026-09-10", dueDate: "2026-09-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4500, invoiceDate: "2026-10-10", dueDate: "2026-10-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 4500, invoiceDate: "2026-11-10", dueDate: "2026-11-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 4500, invoiceDate: "2026-12-10", dueDate: "2026-12-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 19. LEX BORRERO ─────────────────────────
  {
    name: "Lex Borrero",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month (starting Feb 15)",
    monthlyAmount: 4200,
    billTo: "MCMXVI Investments, LLC",
    billEmails: ["lex@neon16.com"],
    notes: "3250 NE18TH ST UNIT 207 MIAMI, FL 33132. Renewal signed.",
    contractStartDate: "2026-02-15",
    contractEndDate: null,
    invoices: [
      { month: 2, year: 2026, amount: 4200, invoiceDate: "2026-02-15", dueDate: "2026-02-15", sentDate: null, paidDate: null, status: "OVERDUE", notes: "Renewal start" },
      { month: 3, year: 2026, amount: 4200, invoiceDate: "2026-03-10", dueDate: "2026-03-15", sentDate: "2026-03-23", paidDate: null, status: "OVERDUE", notes: null },
      { month: 4, year: 2026, amount: 4200, invoiceDate: "2026-04-10", dueDate: "2026-04-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4200, invoiceDate: "2026-05-10", dueDate: "2026-05-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4200, invoiceDate: "2026-06-10", dueDate: "2026-06-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4200, invoiceDate: "2026-07-10", dueDate: "2026-07-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4200, invoiceDate: "2026-08-10", dueDate: "2026-08-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4200, invoiceDate: "2026-09-10", dueDate: "2026-09-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4200, invoiceDate: "2026-10-10", dueDate: "2026-10-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 4200, invoiceDate: "2026-11-10", dueDate: "2026-11-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 4200, invoiceDate: "2026-12-10", dueDate: "2026-12-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 20. LINDA PAOLA ORTIZ ───────────────────
  {
    name: "Linda Paola Ortiz",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month (starting Feb 1)",
    monthlyAmount: 5000,
    billTo: "Linda Paola Ortiz",
    billEmails: ["Cata2034@gmail.com"],
    notes: "Pago $2500 + $2500 on 02/05",
    contractStartDate: "2026-02-01",
    contractEndDate: null,
    invoices: [
      { month: 2, year: 2026, amount: 5000, invoiceDate: "2026-02-01", dueDate: "2026-02-01", sentDate: null, paidDate: "2026-02-05", status: "PAID", notes: "$2500 + $2500 on 02/05" },
      { month: 3, year: 2026, amount: 5000, invoiceDate: "2026-02-25", dueDate: "2026-03-01", sentDate: "2026-02-25", paidDate: null, status: "OVERDUE", notes: "Resend please" },
      { month: 4, year: 2026, amount: 5000, invoiceDate: "2026-03-25", dueDate: "2026-04-01", sentDate: "2026-03-23", paidDate: null, status: "SENT", notes: null },
      { month: 5, year: 2026, amount: 5000, invoiceDate: "2026-04-25", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 5000, invoiceDate: "2026-05-25", dueDate: "2026-06-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 5000, invoiceDate: "2026-06-25", dueDate: "2026-07-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 5000, invoiceDate: "2026-07-25", dueDate: "2026-08-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 5000, invoiceDate: "2026-08-25", dueDate: "2026-09-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 5000, invoiceDate: "2026-09-25", dueDate: "2026-10-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 5000, invoiceDate: "2026-10-25", dueDate: "2026-11-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 21. TATIANA GUIRIBITEY ──────────────────
  {
    name: "Tatiana Guiribitey",
    contractStatus: "SIGNED",
    contractEnd: "April 2, 2026",
    monthlyAmount: 4200,
    billTo: "Tatiana Guiribitey",
    billEmails: ["tatyg22@icloud.com"],
    notes: null,
    contractStartDate: "2026-02-02",
    contractEndDate: "2026-04-02",
    invoices: [
      { month: 2, year: 2026, amount: 4200, invoiceDate: "2026-02-02", dueDate: "2026-02-02", sentDate: null, paidDate: "2026-02-01", status: "PAID", notes: "Deposit" },
      { month: 3, year: 2026, amount: 4200, invoiceDate: "2026-02-25", dueDate: "2026-03-01", sentDate: "2026-02-25", paidDate: "2026-03-05", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 4200, invoiceDate: "2026-03-25", dueDate: "2026-04-01", sentDate: "2026-03-30", paidDate: "2026-03-03", status: "PAID", notes: null },
    ],
  },

  // ─── 22. DIEGO URQUIJO ───────────────────────
  {
    name: "Diego Urquijo",
    contractStatus: "SENT",
    contractEnd: "Month to Month",
    monthlyAmount: 4500,
    billTo: "PuTech Solutions USA LLC",
    billEmails: ["du@soydiegoup.com", "vs@urpeintegralservices.co"],
    notes: "Sent / Waiting on Signature",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 4500, invoiceDate: "2026-03-25", dueDate: "2026-04-01", sentDate: null, paidDate: null, status: "SENT", notes: null },
      { month: 4, year: 2026, amount: 4500, invoiceDate: "2026-04-25", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-05-25", dueDate: "2026-06-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4500, invoiceDate: "2026-06-25", dueDate: "2026-07-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4500, invoiceDate: "2026-07-25", dueDate: "2026-08-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 4500, invoiceDate: "2026-08-25", dueDate: "2026-09-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 4500, invoiceDate: "2026-09-25", dueDate: "2026-10-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 4500, invoiceDate: "2026-10-25", dueDate: "2026-11-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 4500, invoiceDate: "2026-11-25", dueDate: "2026-12-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 23. LYA MARIELLA ────────────────────────
  {
    name: "Lya Mariella",
    contractStatus: "SIGNED",
    contractEnd: "April 5, 2026",
    monthlyAmount: 4500,
    billTo: "Lya Mariella, LLC",
    billEmails: ["lya@lyamariellablog.com"],
    notes: "603 Miramar Ave Apt 2, San Juan PR 00907. $40 photographer due — send on next invoice",
    contractStartDate: "2026-02-05",
    contractEndDate: "2026-04-05",
    invoices: [
      { month: 2, year: 2026, amount: 2000, invoiceDate: "2026-02-05", dueDate: "2026-02-05", sentDate: null, paidDate: "2026-02-11", status: "PAID", notes: "Deposit" },
      { month: 3, year: 2026, amount: 4500, invoiceDate: "2026-03-01", dueDate: "2026-03-05", sentDate: "2026-02-27", paidDate: "2026-03-01", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 4500, invoiceDate: "2026-04-01", dueDate: "2026-04-05", sentDate: "2026-03-30", paidDate: null, status: "SENT", notes: "+$40 photographer" },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-05-01", dueDate: "2026-05-05", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 24. STEPHANY ABASALI ────────────────────
  {
    name: "Stephany Abasali",
    contractStatus: "SIGNED",
    contractEnd: "June 4, 2026",
    monthlyAmount: 3800,
    billTo: "Adrian Ananguren",
    billEmails: ["adrianaly29@gmail.com"],
    notes: "1 PREP + 3 MONTHS",
    contractStartDate: "2026-02-09",
    contractEndDate: "2026-06-04",
    invoices: [
      { month: 2, year: 2026, amount: 2000, invoiceDate: "2026-02-09", dueDate: "2026-02-09", sentDate: null, paidDate: "2026-02-17", status: "PAID", notes: "Prep deposit" },
      { month: 3, year: 2026, amount: 3800, invoiceDate: "2026-03-15", dueDate: "2026-03-15", sentDate: null, paidDate: "2026-03-09", status: "PAID", notes: null },
      { month: 4, year: 2026, amount: 3800, invoiceDate: "2026-04-14", dueDate: "2026-04-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 3800, invoiceDate: "2026-05-14", dueDate: "2026-05-15", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 25. CHARLIE RINCON ──────────────────────
  {
    name: "Charlie Rincon",
    contractStatus: "SIGNED",
    contractEnd: "June 23, 2026",
    monthlyAmount: 4200,
    billTo: "Charlie Rincon",
    billEmails: ["charlierinconstylist@gmail.com"],
    notes: "1 PREP + 3 MONTHS",
    contractStartDate: "2026-02-23",
    contractEndDate: "2026-06-23",
    invoices: [
      { month: 2, year: 2026, amount: 2000, invoiceDate: "2026-02-23", dueDate: "2026-02-23", sentDate: null, paidDate: null, status: "OVERDUE", notes: "Prep deposit" },
      { month: 3, year: 2026, amount: 4200, invoiceDate: "2026-03-18", dueDate: "2026-03-23", sentDate: "2026-03-24", paidDate: null, status: "OVERDUE", notes: null },
      { month: 4, year: 2026, amount: 4200, invoiceDate: "2026-04-18", dueDate: "2026-04-23", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4200, invoiceDate: "2026-05-18", dueDate: "2026-05-23", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 26. GRACE ANDREA BONILLA ────────────────
  {
    name: "Grace Andrea Bonilla",
    contractStatus: "SIGNED",
    contractEnd: "July 3, 2026",
    monthlyAmount: 4500,
    billTo: "Grace Andrea Bonilla",
    billEmails: ["graciebon04@gmail.com"],
    notes: "1 PREP + 3 MONTHS",
    contractStartDate: "2026-03-03",
    contractEndDate: "2026-07-03",
    invoices: [
      { month: 3, year: 2026, amount: 1500, invoiceDate: "2026-03-03", dueDate: "2026-03-03", sentDate: "2026-03-06", paidDate: "2026-03-13", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 4500, invoiceDate: "2026-03-28", dueDate: "2026-04-03", sentDate: "2026-03-30", paidDate: null, status: "SENT", notes: null },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-04-28", dueDate: "2026-05-03", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4500, invoiceDate: "2026-05-28", dueDate: "2026-06-03", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 27. AVITAL COHEN ────────────────────────
  {
    name: "Avital Cohen",
    contractStatus: "SIGNED",
    contractEnd: "June 13, 2026",
    monthlyAmount: 5000,
    billTo: "Avital Cohen",
    billEmails: ["avital@acholding.co", "shirgolabry@gmail.com"],
    notes: "1 PREP + 1 MONTH",
    contractStartDate: "2026-04-13",
    contractEndDate: "2026-06-13",
    invoices: [
      { month: 4, year: 2026, amount: 1600, invoiceDate: "2026-04-07", dueDate: "2026-04-13", sentDate: "2026-04-07", paidDate: null, status: "SENT", notes: "Prep deposit. Please send invoice." },
      { month: 5, year: 2026, amount: 5000, invoiceDate: "2026-05-07", dueDate: "2026-05-13", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 28. YERI MUA ────────────────────────────
  {
    name: "Yeri MUA",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month (1 prep + ongoing)",
    monthlyAmount: 4000,
    billTo: "MUA ENTERTAINMENT S.A. DE C.V",
    billEmails: ["Reynayvc1@gmail.com"],
    notes: "1 PREP + MONTH TO MONTH",
    contractStartDate: "2026-03-09",
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 1600, invoiceDate: "2026-03-06", dueDate: "2026-03-09", sentDate: "2026-03-06", paidDate: "2026-03-10", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 4000, invoiceDate: "2026-04-01", dueDate: "2026-04-09", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 5, year: 2026, amount: 4000, invoiceDate: "2026-05-01", dueDate: "2026-05-09", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 29. DANIELLA DURAN ──────────────────────
  {
    name: "Daniella Duran",
    contractStatus: "SIGNED",
    contractEnd: null,
    monthlyAmount: 2000,
    billTo: "Didi Sports, Inc",
    billEmails: ["Daniella@didi-sports.com"],
    notes: "1000 Lya comision credit + 1000 March Dani F. $11,500 DUE ON MAY 4 2026 (iHM Podcast Commission)",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 2000, invoiceDate: "2026-03-01", dueDate: "2026-03-01", sentDate: null, paidDate: null, status: "OVERDUE", notes: "1000 Lya comision credit + 1000 March Dani F" },
      { month: 5, year: 2026, amount: 11500, invoiceDate: "2026-05-01", dueDate: "2026-05-04", sentDate: null, paidDate: null, status: "DRAFT", notes: "iHM Podcast Commission" },
    ],
  },

  // ─── 30. ANA VELEZ ───────────────────────────
  {
    name: "Ana Velez",
    contractStatus: "SIGNED",
    contractEnd: "Month to Month (1 prep + ongoing)",
    monthlyAmount: 4200,
    billTo: "Ana Velez Creations INC",
    billEmails: ["anamaria316@gmail.com"],
    notes: "1 PREP + MONTH TO MONTH",
    contractStartDate: "2026-03-11",
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 1600, invoiceDate: "2026-03-11", dueDate: "2026-03-11", sentDate: null, paidDate: "2026-03-11", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 4200, invoiceDate: "2026-04-03", dueDate: "2026-04-11", sentDate: "2026-03-30", paidDate: null, status: "SENT", notes: null },
    ],
  },

  // ─── 31. WE SHOP U ───────────────────────────
  {
    name: "We Shop U",
    contractStatus: "NONE",
    contractEnd: null,
    monthlyAmount: 900,
    billTo: "We Shop U",
    billEmails: ["pr@weshopu.us"],
    notes: "DEBEMOS 1 META",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 900, invoiceDate: "2026-03-29", dueDate: "2026-03-29", sentDate: null, paidDate: "2026-03-29", status: "PAID", notes: "1 META" },
    ],
  },

  // ─── 32. LUIS ALBERTO POSADA ─────────────────
  {
    name: "Luis Alberto Posada",
    contractStatus: "SIGNED",
    contractEnd: "Campaign",
    monthlyAmount: 5000,
    billTo: "Luis Alberto Posada",
    billEmails: ["luisposada.us@gmail.com"],
    notes: "1 PREP + CAMPAIGN MONTH",
    contractStartDate: "2026-03-16",
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 2500, invoiceDate: "2026-03-13", dueDate: "2026-03-16", sentDate: "2026-03-13", paidDate: "2026-03-19", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 5000, invoiceDate: "2026-04-11", dueDate: "2026-04-16", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 33. BETANIA GUERRA ──────────────────────
  {
    name: "Betania Guerra",
    contractStatus: "SIGNED",
    contractEnd: "July 9, 2026",
    monthlyAmount: 5000,
    billTo: "Betania Guerra",
    billEmails: ["beplasticsurgery@gmail.com"],
    notes: "1 PREP + 3 MONTHS",
    contractStartDate: "2026-03-09",
    contractEndDate: "2026-07-09",
    invoices: [
      { month: 3, year: 2026, amount: 1500, invoiceDate: "2026-03-09", dueDate: "2026-03-09", sentDate: null, paidDate: "2026-03-13", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 5000, invoiceDate: "2026-04-05", dueDate: "2026-04-09", sentDate: "2026-04-02", paidDate: null, status: "SENT", notes: null },
      { month: 5, year: 2026, amount: 5000, invoiceDate: "2026-05-05", dueDate: "2026-05-09", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 5000, invoiceDate: "2026-06-05", dueDate: "2026-06-09", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 34. DIRTY RABBIT ────────────────────────
  {
    name: "Dirty Rabbit",
    contractStatus: "SIGNED",
    contractEnd: "February 17, 2027",
    monthlyAmount: 3800,
    billTo: "The Dirty Rabbit, LLC",
    billEmails: ["the_dirty_rabbit@gmail.com", "accountingclerk@dirtyrabbitgroup.com", "accounting.tdr@thedirtyrabbitgroup.com", "mary@thedirtyrabbitgroup.com"],
    notes: "151 NW 24th St Unit 107 Miami, FL 33127. Please send W9.",
    contractStartDate: "2026-03-17",
    contractEndDate: "2027-02-17",
    invoices: [
      { month: 3, year: 2026, amount: 2000, invoiceDate: "2026-03-17", dueDate: "2026-03-17", sentDate: "2026-03-19", paidDate: "2026-03-27", status: "PAID", notes: "Prep deposit" },
      { month: 4, year: 2026, amount: 5000, invoiceDate: "2026-04-12", dueDate: "2026-04-17", sentDate: null, paidDate: null, status: "DRAFT", notes: "First full month" },
      { month: 5, year: 2026, amount: 3800, invoiceDate: "2026-05-12", dueDate: "2026-05-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 3800, invoiceDate: "2026-06-12", dueDate: "2026-06-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 3800, invoiceDate: "2026-07-12", dueDate: "2026-07-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 8, year: 2026, amount: 3800, invoiceDate: "2026-08-12", dueDate: "2026-08-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 9, year: 2026, amount: 3800, invoiceDate: "2026-09-12", dueDate: "2026-09-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 10, year: 2026, amount: 3800, invoiceDate: "2026-10-12", dueDate: "2026-10-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 11, year: 2026, amount: 3800, invoiceDate: "2026-11-12", dueDate: "2026-11-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 12, year: 2026, amount: 3800, invoiceDate: "2026-12-12", dueDate: "2026-12-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 1, year: 2027, amount: 3800, invoiceDate: "2027-01-12", dueDate: "2027-01-17", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 35. CARY GARCIA / BELLA CIARNI ──────────
  {
    name: "Cary Garcia / Bella Ciarni",
    contractStatus: "SIGNED",
    contractEnd: "Campaign",
    monthlyAmount: 4500,
    billTo: "Bella Ciarni",
    billEmails: ["cgarcia4@yahoo.com"],
    notes: "1 PREP + CAMPAIGN MONTH. Resend with right amount.",
    contractStartDate: "2026-04-01",
    contractEndDate: null,
    invoices: [
      { month: 4, year: 2026, amount: 2000, invoiceDate: "2026-03-30", dueDate: "2026-04-01", sentDate: "2026-03-30", paidDate: "2026-03-31", status: "PAID", notes: "Prep deposit. Resend with right amount." },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-04-25", dueDate: "2026-05-01", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 36. HERLLY ──────────────────────────────
  {
    name: "Herlly",
    contractStatus: "NONE",
    contractEnd: null,
    monthlyAmount: 3000,
    billTo: "Herlly",
    billEmails: ["hmotions@hotmail.com"],
    notes: "Visa payment",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 3, year: 2026, amount: 3000, invoiceDate: "2026-03-30", dueDate: "2026-03-30", sentDate: "2026-03-30", paidDate: null, status: "OVERDUE", notes: null },
    ],
  },

  // ─── 37. ZENA AYOUB ──────────────────────────
  {
    name: "Zena Ayoub",
    contractStatus: "SIGNED",
    contractEnd: "March 28, 2026",
    monthlyAmount: 700,
    billTo: "Zena Ayoub",
    billEmails: ["info@zenaayoub.com"],
    notes: null,
    contractStartDate: "2026-01-28",
    contractEndDate: "2026-03-28",
    invoices: [
      { month: 1, year: 2026, amount: 700, invoiceDate: "2026-01-25", dueDate: "2026-01-28", sentDate: null, paidDate: "2026-01-28", status: "PAID", notes: null },
      { month: 2, year: 2026, amount: 700, invoiceDate: "2026-02-25", dueDate: "2026-02-28", sentDate: "2026-02-25", paidDate: null, status: "OVERDUE", notes: null },
      { month: 3, year: 2026, amount: 700, invoiceDate: "2026-03-25", dueDate: "2026-03-28", sentDate: "2026-03-31", paidDate: null, status: "OVERDUE", notes: "Resent 3-31" },
    ],
  },

  // ─── 38. LOS HITMEN ──────────────────────────
  {
    name: "Los Hitmen",
    contractStatus: "SENT",
    contractEnd: "August 6, 2026",
    monthlyAmount: 4000,
    billTo: "Los Hitmen Global, LLC",
    billEmails: ["loshitmen@gmail.com", "Management@lemovementprojects.com", "marielarios.alc@gmail.com"],
    notes: "Sent / Waiting on Signature. 1 PREP + 3 MONTHS",
    contractStartDate: "2026-04-06",
    contractEndDate: "2026-08-06",
    invoices: [
      { month: 4, year: 2026, amount: 2000, invoiceDate: "2026-04-06", dueDate: "2026-04-06", sentDate: "2026-04-07", paidDate: null, status: "SENT", notes: "Prep deposit" },
      { month: 5, year: 2026, amount: 4000, invoiceDate: "2026-05-01", dueDate: "2026-05-06", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4000, invoiceDate: "2026-06-01", dueDate: "2026-06-06", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 7, year: 2026, amount: 4000, invoiceDate: "2026-07-01", dueDate: "2026-07-06", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },

  // ─── 39. MARIANELA ANCHETA ───────────────────
  {
    name: "Marianela Ancheta",
    contractStatus: "SENT",
    contractEnd: null,
    monthlyAmount: 4500,
    billTo: "Marianela Ancheta",
    billEmails: ["marianelaancheta@hotmail.com"],
    notes: "Sent / Waiting on Signature. SEND INVOICE FOR 10K",
    contractStartDate: null,
    contractEndDate: null,
    invoices: [
      { month: 4, year: 2026, amount: 1000, invoiceDate: "2026-04-01", dueDate: "2026-04-07", sentDate: null, paidDate: null, status: "DRAFT", notes: "Deposit" },
      { month: 5, year: 2026, amount: 4500, invoiceDate: "2026-04-25", dueDate: "2026-05-07", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
      { month: 6, year: 2026, amount: 4500, invoiceDate: "2026-05-25", dueDate: "2026-06-25", sentDate: null, paidDate: null, status: "DRAFT", notes: null },
    ],
  },
];

// ─── IMPORT HANDLER ────────────────────────────────────────

export async function POST() {
  const results: { client: string; contractId?: string; invoiceCount: number; contactsAdded: number }[] = [];

  for (const c of CLIENTS) {
    // 1. Find or create client
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    let client = await db.client.findFirst({
      where: {
        OR: [
          { slug },
          { name: { contains: c.name.split(" ")[0], mode: "insensitive" } },
        ],
      },
    });

    if (!client) {
      client = await db.client.create({
        data: {
          name: c.name,
          slug,
          status: "ACTIVE",
          monthlyTarget: 6,
        },
      });
    }

    // 2. Create contract (if has one)
    let contractId: string | undefined;
    if (c.contractStatus !== "NONE") {
      const prismaStatus = c.contractStatus === "SIGNED" ? "SIGNED" : "SENT";
      const existingContract = await db.contract.findFirst({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
      });

      if (existingContract) {
        // Update existing
        await db.contract.update({
          where: { id: existingContract.id },
          data: {
            status: prismaStatus,
            value: c.monthlyAmount,
            startDate: c.contractStartDate ? new Date(c.contractStartDate) : undefined,
            endDate: c.contractEndDate ? new Date(c.contractEndDate) : undefined,
            notes: [
              c.contractEnd ? `Term: ${c.contractEnd}` : null,
              c.billTo ? `Bill to: ${c.billTo}` : null,
              c.notes,
            ].filter(Boolean).join(". "),
            billingReady: true,
          },
        });
        contractId = existingContract.id;
      } else {
        const contract = await db.contract.create({
          data: {
            clientId: client.id,
            title: `${c.name} — PR Services ${c.contractEnd === "Month to Month" || c.contractEnd?.includes("Month to Month") ? "(Month to Month)" : "2026"}`,
            status: prismaStatus,
            value: c.monthlyAmount,
            startDate: c.contractStartDate ? new Date(c.contractStartDate) : null,
            endDate: c.contractEndDate ? new Date(c.contractEndDate) : null,
            notes: [
              c.contractEnd ? `Term: ${c.contractEnd}` : null,
              c.billTo ? `Bill to: ${c.billTo}` : null,
              c.notes,
            ].filter(Boolean).join(". "),
            billingReady: true,
            signedAt: prismaStatus === "SIGNED" ? (c.contractStartDate ? new Date(c.contractStartDate) : new Date()) : null,
            sentAt: prismaStatus === "SENT" ? new Date() : null,
          },
        });
        contractId = contract.id;
      }
    }

    // 3. Create invoices (skip duplicates)
    let invoiceCount = 0;
    for (const inv of c.invoices) {
      const invoiceNumber = `EBPR-${slug.substring(0, 8).toUpperCase()}-${inv.year}-${String(inv.month).padStart(2, "0")}`;

      const existing = await db.invoice.findUnique({ where: { invoiceNumber } });
      if (existing) continue;

      await db.invoice.create({
        data: {
          clientId: client.id,
          contractId: contractId || null,
          invoiceNumber,
          amount: inv.amount,
          status: inv.status,
          issuedAt: inv.sentDate ? new Date(inv.sentDate) : new Date(inv.invoiceDate),
          dueDate: new Date(inv.dueDate),
          paidAt: inv.paidDate ? new Date(inv.paidDate) : null,
          notes: inv.notes,
        },
      });

      // If paid, also create a payment record
      if (inv.paidDate) {
        const createdInvoice = await db.invoice.findUnique({ where: { invoiceNumber } });
        if (createdInvoice) {
          await db.payment.create({
            data: {
              invoiceId: createdInvoice.id,
              amount: inv.amount,
              paidAt: new Date(inv.paidDate),
              method: "WIRE",
              notes: inv.notes,
            },
          });
        }
      }

      invoiceCount++;
    }

    // 4. Add billing contacts
    let contactsAdded = 0;
    if (c.billEmails.length > 0 || c.billTo) {
      for (const email of c.billEmails) {
        const existingContact = await db.contact.findFirst({
          where: { clientId: client.id, email },
        });
        if (!existingContact) {
          await db.contact.create({
            data: {
              clientId: client.id,
              name: c.billTo || c.name,
              email,
              role: "Billing",
              isPrimary: contactsAdded === 0,
              notes: c.notes,
            },
          });
          contactsAdded++;
        }
      }
    }

    results.push({
      client: c.name,
      contractId,
      invoiceCount,
      contactsAdded,
    });
  }

  return NextResponse.json({
    success: true,
    imported: results.length,
    results,
  });
}
