import { UserRole } from "@prisma/client";
import type { SessionUser } from "./auth";

// ─── Role checks ─────────────────────────────────────────

export const isSuperAdmin = (u: SessionUser) => u.role === UserRole.SUPER_ADMIN;
export const isStrategist = (u: SessionUser) => u.role === UserRole.STRATEGIST;
export const isRunner = (u: SessionUser) => u.role === UserRole.RUNNER;
export const isLegal = (u: SessionUser) => u.role === UserRole.LEGAL;
export const isFinance = (u: SessionUser) => u.role === UserRole.FINANCE;

export const canManageClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewClients = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST || u.role === UserRole.LEGAL || u.role === UserRole.FINANCE;

export const canManageContracts = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.LEGAL;

export const canViewContracts = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.LEGAL || u.role === UserRole.FINANCE;

export const canManageDeliverables = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageTasks = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageRunners = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canViewRunnerSchedule = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST || u.role === UserRole.RUNNER;

export const canRequestApprovals = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const canManageUsers = (u: SessionUser) => isSuperAdmin(u);

export const canViewReports = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST || u.role === UserRole.FINANCE;

// ─── Data visibility ─────────────────────────────────────

export const canSeeInternalData = (u: SessionUser) =>
  u.role === UserRole.SUPER_ADMIN || u.role === UserRole.STRATEGIST;

export const runnerScope = (u: SessionUser) =>
  u.role === UserRole.RUNNER ? u.id : null;
