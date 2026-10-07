import { UserRole } from "@prisma/client";
import type { SessionUser } from "./auth";

// ─── Role checks ─────────────────────────────────────────

export const isSuperAdmin = (u: SessionUser) => u.role === UserRole.SUPER_ADMIN;
export const isStrategist = (u: SessionUser) => u.role === UserRole.STRATEGIST;
export const isRunner = (u: SessionUser) => u.role === UserRole.RUNNER;
export const isLegal = (u: SessionUser) => u.role === UserRole.LEGAL;
export const isAssistant = (u: SessionUser) => u.role === UserRole.ASSISTANT;

// ─── Feature access ──────────────────────────────────────
// SUPER_ADMIN (Esther): everything
// STRATEGIST: dashboard, clients, runners, press releases
// LEGAL (Jessica): legal + follow-up
// Follow-up: ASSISTANT
// ASSISTANT (Carolina): follow-up portal only
// RUNNER: external portal only

export const canManageClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageContracts = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.LEGAL;

export const canViewContracts = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.LEGAL;

export const canManageDeliverables = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageTasks = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageRunners = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewRunnerSchedule = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canRequestApprovals = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageUsers = (u: SessionUser) => isSuperAdmin(u);

export const canViewReports = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

/** People kept out of the press area (journalist contacts + press-release list) — Esther, Sept 28 2026. */
export const PRESS_EXCLUDED_EMAILS = ["diana@ebmanagement.io"];
const pressExcluded = (u: SessionUser) => PRESS_EXCLUDED_EMAILS.includes((u.email ?? "").toLowerCase());

/** Press-release list, drafts, approval, distribution: admins + strategists (minus the excluded). */
export const canManagePressReleases = (u: SessionUser) =>
  (u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST) && !pressExcluded(u);
/** Who may open the Press Releases page at all: the above plus the writer (who only sees the requests board). */
export const canOpenPressPage = (u: SessionUser) => canManagePressReleases(u) || u.role === UserRole.WRITER;
/** Press-release requests board (Michel's queue): press people + the writer. */
export const canSeePressRequests = (u: SessionUser) => canOpenPressPage(u);

/** Only Esther may distribute a press release from the portal (Esther, Sept 28 2026). */
export const PRESS_SENDER_EMAIL = "esther@ebmanagement.io";
export const canSendPressReleases = (u: SessionUser) => (u.email ?? "").toLowerCase() === PRESS_SENDER_EMAIL;

// "Necesitamos un comunicado" requests: strategists ask, the writer (Michel) delivers.
export const canRequestPressRelease = (u: SessionUser) =>
  (u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST) && !pressExcluded(u);
export const isWriter = (u: SessionUser) => u.role === UserRole.WRITER;
export const canWorkPressReleaseRequests = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.WRITER;

/** Outreach database ("Music Industry"): Esther's private list — only she sees or sends from it (Oct 7 2026). */
export const OUTREACH_OWNER_EMAILS = ["esther@ebmanagement.io"];
export const canManageOutreach = (u: SessionUser) => OUTREACH_OWNER_EMAILS.includes((u.email ?? "").toLowerCase());

export const canManageJournalists = (u: SessionUser) =>
  (u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST) && !pressExcluded(u);

export const canViewFollowUp = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.ASSISTANT || u.role === UserRole.LEGAL;

// ─── Data visibility ─────────────────────────────────────

export const canSeeInternalData = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const runnerScope = (u: SessionUser) =>
  u.role === UserRole.RUNNER ? u.id : null;
