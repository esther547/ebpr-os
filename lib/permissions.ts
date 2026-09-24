import { UserRole } from "@prisma/client";
import { canSeeFinance } from "@/lib/finance-visibility";
import type { SessionUser } from "./auth";

// ─── Role checks ─────────────────────────────────────────

export const isSuperAdmin = (u: SessionUser) => u.role === UserRole.SUPER_ADMIN;
export const isStrategist = (u: SessionUser) => u.role === UserRole.STRATEGIST;
export const isRunner = (u: SessionUser) => u.role === UserRole.RUNNER;
export const isLegal = (u: SessionUser) => u.role === UserRole.LEGAL;
export const isFinance = (u: SessionUser) => u.role === UserRole.FINANCE;
export const isAssistant = (u: SessionUser) => u.role === UserRole.ASSISTANT;

// ─── Feature access ──────────────────────────────────────
// SUPER_ADMIN (Esther): everything
// STRATEGIST: dashboard, clients, runners, press releases
// LEGAL (Jessica): legal + follow-up
// FINANCE (Laurie): follow-up only
// ASSISTANT (Carolina): follow-up portal only
// RUNNER: external portal only

export const canManageClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

// Contracts carry amounts: while Legal is paused, only Esther can see or edit them.
export const canManageContracts = (u: SessionUser) => canSeeFinance(u);

export const canViewContracts = (u: SessionUser) => canSeeFinance(u);

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

export const canManagePressReleases = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageJournalists = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewFollowUp = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.ASSISTANT || u.role === UserRole.FINANCE || u.role === UserRole.LEGAL;

// ─── Data visibility ─────────────────────────────────────

export const canSeeInternalData = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const runnerScope = (u: SessionUser) =>
  u.role === UserRole.RUNNER ? u.id : null;
