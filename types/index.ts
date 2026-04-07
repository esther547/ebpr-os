import {
  User,
  Client,
  Contact,
  Contract,
  Onboarding,
  OnboardingChecklistItem,
  StrategyItem,
  StrategyDocument,
  Campaign,
  Deliverable,
  Task,
  RunnerAssignment,
  RunnerAvailability,
  Approval,
  ApprovalResponse,
  File as DBFile,
  ActivityLog,
  Comment,
  Report,
  ClientUser,
  UserRole,
  ClientStatus,
  ContractStatus,
  OnboardingStatus,
  StrategyCategory,
  StrategyStatus,
  CampaignStatus,
  DeliverableType,
  DeliverableStatus,
  TaskStatus,
  Priority,
  ApprovalType,
  ApprovalStatus,
  AssignmentStatus,
} from "@prisma/client";

// Re-export all enums and models
export {
  UserRole,
  ClientStatus,
  ContractStatus,
  OnboardingStatus,
  StrategyCategory,
  StrategyStatus,
  CampaignStatus,
  DeliverableType,
  DeliverableStatus,
  TaskStatus,
  Priority,
  ApprovalType,
  ApprovalStatus,
  AssignmentStatus,
};

// Re-export StrategyDocument type
export type { StrategyDocument };

// ─── Extended types (with relations) ─────────────────────

export type ClientWithCounts = Client & {
  _count: {
    deliverables: number;
    campaigns: number;
    contracts: number;
  };
  onboarding: { status: OnboardingStatus } | null;
};

export type ClientDetail = Client & {
  contacts: Contact[];
  contracts: Contract[];
  onboarding: (Onboarding & { checklistItems: OnboardingChecklistItem[] }) | null;
  campaigns: Campaign[];
  _count: {
    deliverables: number;
    strategyItems: number;
    files: number;
  };
};

export type DeliverableWithRelations = Deliverable & {
  assignee: Pick<User, "id" | "name" | "avatar"> | null;
  campaign: Pick<Campaign, "id" | "name"> | null;
  strategyItem: Pick<StrategyItem, "id" | "title"> | null;
  _count: {
    tasks: number;
    comments: number;
    files: number;
  };
};

export type DeliverableFull = Deliverable & {
  assignee: Pick<User, "id" | "name" | "avatar"> | null;
  campaign: Pick<Campaign, "id" | "name"> | null;
  strategyItem: StrategyItem | null;
  tasks: (Task & { assignee: Pick<User, "id" | "name"> | null })[];
  comments: (Comment & { user: Pick<User, "id" | "name" | "avatar"> })[];
  files: DBFile[];
  approvals: Approval[];
};

export type CampaignWithDeliverables = Campaign & {
  deliverables: DeliverableWithRelations[];
  _count: {
    deliverables: number;
    strategyItems: number;
    tasks: number;
  };
};

export type TaskWithAssignee = Task & {
  assignee: Pick<User, "id" | "name" | "avatar"> | null;
};

export type RunnerScheduleEntry = RunnerAssignment & {
  runner: Pick<User, "id" | "name" | "avatar">;
};

export type AgendaItemWithRunner = RunnerAssignment & {
  runner: Pick<User, "id" | "name"> | null;
  deliverable: Pick<Deliverable, "id" | "title" | "type"> | null;
};

export type StrategyItemEnriched = StrategyItem;

export type StrategyDocumentWithItems = StrategyDocument & {
  client: Pick<Client, "id" | "name">;
};

export type ApprovalWithResponses = Approval & {
  requestedBy: Pick<User, "id" | "name">;
  deliverable: Pick<Deliverable, "id" | "title"> | null;
  responses: (ApprovalResponse & {
    clientUser: Pick<ClientUser, "id" | "name"> | null;
  })[];
};

export type ActivityWithUser = ActivityLog & {
  user: Pick<User, "id" | "name" | "avatar">;
};

// ─── API response types ───────────────────────────────────

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── Dashboard summary types ──────────────────────────────

export type MonthlyPacingSummary = {
  clientId: string;
  clientName: string;
  target: number;
  completed: number;
  inProgress: number;
  month: number;
  year: number;
};

export type DashboardStats = {
  totalClients: number;
  activeClients: number;
  totalDeliverables: number;
  completedThisMonth: number;
  pendingApprovals: number;
  upcomingEvents: number;
};

// ─── Form types ───────────────────────────────────────────

export type CreateClientInput = {
  name: string;
  slug: string;
  industry?: string;
  website?: string;
  monthlyTarget: number;
};

export type CreateDeliverableInput = {
  clientId: string;
  campaignId?: string;
  title: string;
  type: DeliverableType;
  assigneeId?: string;
  dueDate?: string;
  month: number;
  year: number;
  notes?: string;
  isClientVisible: boolean;
};

export type UpdateDeliverableStatusInput = {
  status: DeliverableStatus;
  outcome?: string;
};

export type CreateApprovalInput = {
  clientId: string;
  deliverableId?: string;
  title: string;
  description?: string;
  type: ApprovalType;
  content?: string;
  fileUrl?: string;
};
