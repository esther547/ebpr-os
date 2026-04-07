# EBPR OS — Product Requirements Document

> **Version:** 1.0
> **Date:** April 7, 2026
> **Owner:** Esther Beniflah, CEO — EB Public Relations
> **Status:** In Development (MVP)

---

## 1. Executive Summary

EBPR OS is a custom-built SaaS platform that serves as the operating system for EB Public Relations, a Miami-based PR agency. It replaces Monday.com and fragmented tools with a purpose-built system reflecting EBPR's real workflow: **preparation month -> monthly execution -> 6-8 deliverables per client**.

The system has two faces:
- **Internal Dashboard** — for strategists, runners, legal, and finance
- **Client Portal** — premium, curated view for client stakeholders

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
[Client Browser] --> [Vercel Edge / CDN]
        |
        v
[Next.js 14 App Router]
  |- Server Components (dashboard pages)
  |- API Routes (REST endpoints)
  |- Middleware (Clerk auth + role routing)
        |
   +---------+---------+---------+
   |         |         |         |
[Clerk]  [PostgreSQL] [Supabase] [Future: QuickBooks]
 Auth    via Prisma    Storage    Billing Integration
```

### 2.2 Tech Stack

| Layer        | Technology           | Purpose                          |
|-------------|---------------------|----------------------------------|
| Frontend    | Next.js 14 (App Router) + React 18 | SSR, routing, UI            |
| Styling     | Tailwind CSS + Radix UI | Design system, accessibility    |
| Auth        | Clerk                | Authentication, role management  |
| Database    | PostgreSQL + Prisma  | Data persistence, ORM            |
| Storage     | Supabase (S3)        | File uploads (contracts, assets) |
| State       | Zustand + React Query | Client state, server cache      |
| Validation  | Zod                  | Input validation                 |
| Hosting     | Vercel               | Edge deployment                  |
| Icons       | Lucide React         | Iconography                      |

### 2.3 Route Architecture

```
app/
  (auth)/           # Public: sign-in, sign-up
  (home)/           # Authenticated home: dashboard
  (dashboard)/      # Internal team pages
    clients/        # Client management
    legal/          # Contracts (Jessica)
    runners/        # Runner scheduling
    reports/        # Agency reporting
    settings/       # Team management (Esther only)
  (portal)/         # Client-facing portal
    portal/         # Client dashboard, approvals, agenda, files
  api/              # REST API endpoints
```

---

## 3. Database Schema (Multi-Tenant)

### 3.1 Entity Relationship Overview

```
Users (Clerk-synced, internal)
  |
  +-- assigned -> Deliverables
  +-- assigned -> Tasks
  +-- assigned -> RunnerAssignments
  +-- created -> ActivityLogs
  +-- uploaded -> Files
  +-- requested -> Approvals

ClientUsers (Clerk-synced, portal)
  |
  +-- belongs to -> Client
  +-- responded -> ApprovalResponses

Client (core entity)
  |
  +-- Contacts (1:N)
  +-- Contracts (1:N) --> ContractStatus
  +-- Onboarding (1:1) --> ChecklistItems
  +-- StrategyDocument (1:1) --> printable brief
  +-- StrategyItems (1:N) --> wishlist items
  +-- Campaigns (1:N) --> sub-projects
  +-- Deliverables (1:N) --> the 6-8/month
  +-- Files (1:N) --> assets
  +-- Approvals (1:N) --> client approval flow
  +-- Reports (1:N) --> monthly summaries
  +-- ActivityLogs (1:N) --> audit trail
```

### 3.2 Core Tables (19 models)

| Model                   | Purpose                              | Key Fields                                     |
|------------------------|--------------------------------------|-------------------------------------------------|
| User                   | Internal team member                 | clerkId, role, email, name                      |
| ClientUser             | Client portal user                   | clerkId, clientId, role                         |
| Client                 | Client/account record                | name, slug, status, monthlyTarget               |
| Contact                | Client contact person                | name, email, phone, isPrimary                   |
| Contract               | Legal document                       | status, fileUrl, value, billingReady            |
| Onboarding             | Onboarding workflow                  | status, narrative, goals, questionnaire         |
| OnboardingChecklistItem| Checklist step                       | label, completed, order                         |
| StrategyDocument       | Full strategy brief                  | purpose, objective, phases, messaging           |
| StrategyItem           | Wishlist / pipeline item             | category, status, targetName, isBigWin          |
| Campaign               | Monthly/project campaign             | status, objectives, monthlyTarget               |
| Deliverable            | PR action (THE core unit)            | type, status, month/year, outcome               |
| Task                   | Internal work item                   | status, priority, dueDate                       |
| RunnerAssignment       | Event/logistics assignment           | eventDate, venueName, arrivalTime               |
| RunnerAvailability     | Runner calendar                      | date, isAvailable                               |
| Approval               | Item sent for client approval        | type, status, version, content                  |
| ApprovalResponse       | Client's response                    | status, comment                                 |
| File                   | Uploaded asset                       | url, isClientVisible, tags                      |
| ActivityLog            | Audit trail                          | action, description, metadata                   |
| Comment                | Discussion on deliverable            | content, isInternal                             |
| Report                 | Monthly summary                      | month, year, data (JSON), isPublished           |

### 3.3 Key Enums

- **UserRole**: SUPER_ADMIN, STRATEGIST, RUNNER, LEGAL, FINANCE, CLIENT_ADMIN, CLIENT_VIEWER
- **DeliverableStatus**: IDEA -> OUTREACH -> CONFIRMED -> IN_PROGRESS -> COMPLETED | CANCELLED
- **DeliverableType**: PRESS_PLACEMENT, INTERVIEW, INFLUENCER_COLLAB, EVENT_APPEARANCE, BRAND_OPPORTUNITY, INTRODUCTION, SOCIAL_MEDIA, PRESS_RELEASE, OTHER
- **ContractStatus**: DRAFT -> SENT -> SIGNED | EXPIRED | TERMINATED
- **OnboardingStatus**: NOT_STARTED -> KICKOFF_SCHEDULED -> KICKOFF_COMPLETE -> QUESTIONNAIRE_SENT -> QUESTIONNAIRE_RECEIVED -> STRATEGY_IN_PROGRESS -> COMPLETE
- **StrategyCategory**: MEDIA_TARGET, INFLUENCER, EVENT, BRAND_OPPORTUNITY, POSITIONING, OTHER
- **ApprovalStatus**: PENDING -> APPROVED | REJECTED | REVISION_REQUESTED

---

## 4. User Roles & Permission Model

### 4.1 Role Matrix

| Capability                  | Super Admin | Strategist | Runner | Legal | Finance | Client Admin | Client Viewer |
|---------------------------|:-----------:|:----------:|:------:|:-----:|:-------:|:------------:|:-------------:|
| View all clients          |      Y      |     Y      |   N    |   Y   |    Y    |     Own      |     Own       |
| Manage clients            |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |
| Manage deliverables       |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |
| View deliverables         |      Y      |     Y      |   N    |   N   |    N    |     Own      |     Own       |
| Manage contracts          |      Y      |     N      |   N    |   Y   |    N    |      N       |      N        |
| View contracts            |      Y      |     N      |   N    |   Y   |    Y    |      N       |      N        |
| Manage tasks              |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |
| Manage runners            |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |
| View runner schedule      |      Y      |     Y      |  Own   |   N   |    N    |      N       |      N        |
| Request approvals         |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |
| Respond to approvals      |      N      |     N      |   N    |   N   |    N    |      Y       |      N        |
| View reports              |      Y      |     Y      |   N    |   N   |    Y    |     Own      |     Own       |
| Manage users/settings     |      Y      |     N      |   N    |   N   |    N    |      N       |      N        |
| See internal data         |      Y      |     Y      |   N    |   N   |    N    |      N       |      N        |

### 4.2 Route Access (Middleware-Enforced)

| Route Pattern        | Allowed Roles                        |
|---------------------|--------------------------------------|
| /dashboard          | SUPER_ADMIN, STRATEGIST              |
| /clients/*          | SUPER_ADMIN, STRATEGIST, FINANCE (limited) |
| /legal/*            | SUPER_ADMIN, LEGAL                   |
| /runners/*          | SUPER_ADMIN, STRATEGIST, RUNNER      |
| /reports/*          | SUPER_ADMIN, STRATEGIST, FINANCE     |
| /settings/*         | SUPER_ADMIN                          |
| /portal/*           | CLIENT_ADMIN, CLIENT_VIEWER          |

---

## 5. Workflow Diagrams

### 5.1 Client Lifecycle

```
PROSPECT ──> Contract Signed ──> ACTIVE ──> Onboarding
                                    |
                                    v
                          Preparation Month (30 days)
                          - Build Strategy Wishlist
                          - Define media targets, influencers, events
                                    |
                                    v
                          Monthly Execution Cycle
                          ┌─────────────────────────┐
                          │ Month N                  │
                          │ Target: 6-8 deliverables │
                          │ IDEA -> OUTREACH ->      │
                          │ CONFIRMED -> IN_PROGRESS  │
                          │ -> COMPLETED              │
                          └────────┬────────────────┘
                                   │ Repeat monthly
                                   v
                          PAUSED / CHURNED (if contract ends)
```

### 5.2 Deliverable Pipeline

```
Strategy Item (Wishlist)
        |
        v
  [IDEA] ────> [OUTREACH] ────> [CONFIRMED] ────> [IN_PROGRESS] ────> [COMPLETED]
                                       |                                    |
                                  [CANCELLED]                          Log outcome
                                                                       as "Win"
```

### 5.3 Approval Flow

```
Strategist creates Approval Request
  (type: strategy_idea | press_release | interview_questions | proposal)
        |
        v
  [PENDING] ──> Client sees in Portal
        |
        ├── Client clicks APPROVE ──> [APPROVED] ──> Proceed
        ├── Client clicks REVISION ──> [REVISION_REQUESTED] ──> Team revises, new version
        └── Client clicks REJECT ──> [REJECTED] ──> Team pivots
```

### 5.4 Onboarding Flow

```
[NOT_STARTED]
      |
      v
[KICKOFF_SCHEDULED] ──> Meeting with client
      |
      v
[KICKOFF_COMPLETE] ──> Capture: narrative, goals, vision, positioning
      |
      v
[QUESTIONNAIRE_SENT] ──> Tomas sends questionnaire
      |
      v
[QUESTIONNAIRE_RECEIVED] ──> Responses stored
      |
      v
[STRATEGY_IN_PROGRESS] ──> Build wishlist + strategy doc
      |
      v
[COMPLETE] ──> Ready for Preparation Month
```

### 5.5 Runner Assignment Flow

```
Strategist identifies event/appearance
        |
        v
Create Runner Assignment
  - eventDate, arrivalTime, eventTime
  - venueName, venueAddress
  - itemType (TV, Podcast, Red Carpet, Event)
        |
        v
[SCHEDULED] ──> [CONFIRMED] ──> [COMPLETED]
                     |
                [CANCELLED]
```

---

## 6. Page-by-Page UI Structure

### 6.1 Internal Dashboard Pages

| Page                        | Route                                      | Purpose                                    | Status    |
|----------------------------|--------------------------------------------|--------------------------------------------|-----------|
| Dashboard                  | /dashboard                                  | Agency overview, all client pacing          | BUILT     |
| Client List                | /clients                                    | All clients grouped by status               | BUILT     |
| Client Detail              | /clients/[id]                               | Client overview with tabbed sections        | BUILT     |
| Client Onboarding          | /clients/[id]/onboarding                    | Onboarding progress + checklist             | BUILT (no forms) |
| Client Strategy            | /clients/[id]/strategy                      | Strategy wishlist + document                | BUILT (no forms) |
| Strategy Brief             | /clients/[id]/strategy/brief                | Printable strategy document                 | BUILT     |
| Client Deliverables        | /clients/[id]/deliverables                  | Kanban board of deliverables                | BUILT (no forms) |
| Client Agenda              | /clients/[id]/agenda                        | Event schedule by month                     | BUILT (no forms) |
| Client Campaigns           | /clients/[id]/campaigns                     | Campaign list                               | NOT BUILT |
| Client Tasks               | /clients/[id]/tasks                         | Task list for client                        | NOT BUILT |
| Legal / Contracts          | /legal                                      | Contract management                         | BUILT (no forms) |
| Runners Schedule           | /runners/schedule                           | Weekly assignment calendar                  | BUILT (no forms) |
| Reports                    | /reports                                    | Agency-wide pacing dashboard                | BUILT     |
| Settings                   | /settings                                   | Team management                             | BUILT (no forms) |

### 6.2 Client Portal Pages

| Page                | Route              | Purpose                              | Status    |
|--------------------|--------------------|--------------------------------------|-----------|
| Portal Dashboard   | /portal            | Wins, in-progress, stats             | BUILT     |
| Portal Approvals   | /portal/approvals  | Approve/reject items                 | BUILT     |
| Portal Agenda      | /portal/agenda     | Upcoming events/appearances          | BUILT     |
| Portal Files       | /portal/files      | Shared documents                     | NOT BUILT |
| Portal Reports     | /portal/reports    | Monthly report view                  | NOT BUILT |

---

## 7. MVP Definition

### MVP = What's needed for EBPR to start using the system daily

**MUST HAVE (MVP):**
1. Working auth + role-based access (DONE)
2. Client CRUD with full detail pages (90% done — needs create/edit forms)
3. Deliverables CRUD with kanban view + pacing (80% done — needs create/edit forms)
4. Strategy wishlist management (80% done — needs create/edit forms)
5. Contract management for Jessica (60% done — needs create/edit forms)
6. Onboarding workflow with checklist (70% done — needs action buttons)
7. Runner scheduling (70% done — needs assignment forms)
8. Client portal with approvals (90% done)
9. Agency dashboard with pacing (DONE)
10. File upload attached to clients/deliverables (API done — needs UI)
11. Activity logging (API done — needs timeline UI)

**NOT MVP (Phase 2):**
- Campaign sub-project management
- Task management UI
- Comments/discussion threads
- Global search
- Email notifications
- QuickBooks integration
- PDF report export (beyond strategy brief)
- Bulk import/export
- Mobile optimization

---

## 8. Phase 2 Roadmap

| Phase | Feature                    | Priority | Effort |
|-------|---------------------------|----------|--------|
| 2.1   | Task management UI         | HIGH     | 2 days |
| 2.2   | Campaign management UI     | HIGH     | 2 days |
| 2.3   | Comment threads            | MEDIUM   | 1 day  |
| 2.4   | Global search              | MEDIUM   | 2 days |
| 2.5   | Email notifications        | HIGH     | 3 days |
| 2.6   | Client file browser (portal)| MEDIUM  | 1 day  |
| 2.7   | PDF monthly reports        | MEDIUM   | 2 days |
| 2.8   | QuickBooks integration     | LOW      | 5 days |
| 2.9   | Calendar sync (Google)     | LOW      | 3 days |
| 2.10  | Slack notifications        | LOW      | 2 days |
| 2.11  | AI strategy suggestions    | LOW      | 3 days |
| 2.12  | Bulk operations            | LOW      | 2 days |

---

## 9. Folder Structure

```
ebpr-os/
  app/
    (auth)/
      sign-in/[[...sign-in]]/page.tsx
    (home)/
      layout.tsx
      dashboard/page.tsx
    (dashboard)/
      layout.tsx                    # Sidebar + header
      clients/
        page.tsx                    # Client list
        [clientId]/
          page.tsx                  # Client overview
          onboarding/page.tsx
          strategy/page.tsx
          strategy/brief/page.tsx
          deliverables/page.tsx
          agenda/page.tsx
          campaigns/page.tsx        # TO BUILD
          tasks/page.tsx            # TO BUILD
      legal/page.tsx
      runners/
        page.tsx                    # Redirect
        schedule/page.tsx
      reports/page.tsx
      settings/page.tsx
    (portal)/
      layout.tsx
      portal/
        page.tsx                    # Portal dashboard
        approvals/page.tsx
        agenda/page.tsx
        files/page.tsx              # TO BUILD
        reports/page.tsx            # TO BUILD
    api/
      clients/
        route.ts                    # GET, POST
        [clientId]/
          route.ts                  # GET, PUT
          agenda/
            route.ts                # GET, POST
            [itemId]/route.ts       # PATCH, DELETE
          strategy/
            bulk/route.ts           # POST, DELETE
            document/route.ts       # GET, POST, PUT, DELETE
      deliverables/
        route.ts                    # POST
        [id]/
          route.ts                  # GET, PUT (TO BUILD)
          status/route.ts           # POST
      approvals/
        route.ts                    # POST
        [id]/
          respond/route.ts          # POST
      files/
        upload/route.ts             # POST
      reports/
        [clientId]/
          monthly/route.ts          # GET
      tasks/
        route.ts                    # TO BUILD (CRUD)
      campaigns/
        route.ts                    # TO BUILD (CRUD)
      contracts/
        route.ts                    # TO BUILD (CRUD)
      onboarding/
        [clientId]/route.ts         # TO BUILD (PUT)
    globals.css
    layout.tsx                      # Root layout (Clerk, fonts)
    page.tsx                        # Role-based redirect
  components/
    brand/ebpr-logo.tsx
    layout/sidebar.tsx, header.tsx
    clients/client-card.tsx
    deliverables/deliverable-board.tsx, pacing-bar.tsx
    strategy/strategy-*.tsx (7 files)
    dashboard/agency-stats-bar.tsx, client-command-center.tsx, etc.
    agenda/agenda-month-section.tsx
    portal/portal-nav.tsx
    runners/runner-schedule-view.tsx
    ui/                             # TO BUILD: shared form components
      modal.tsx
      form-field.tsx
      status-badge.tsx
      data-table.tsx
  lib/
    auth.ts
    db.ts
    permissions.ts
    supabase.ts
    utils.ts
  prisma/
    schema.prisma
    seed.ts
  types/
    index.ts
  public/
    favicon.svg
  middleware.ts
  Config files...
```

---

## 10. API Design

### 10.1 Existing Endpoints

| Method | Endpoint                                      | Purpose                    | Auth Required |
|--------|-----------------------------------------------|----------------------------|---------------|
| GET    | /api/clients                                   | List all clients           | STRATEGIST+   |
| POST   | /api/clients                                   | Create client              | STRATEGIST+   |
| GET    | /api/clients/[id]                              | Get client detail          | STRATEGIST+   |
| PUT    | /api/clients/[id]                              | Update client              | STRATEGIST+   |
| POST   | /api/deliverables                              | Create deliverable         | STRATEGIST+   |
| POST   | /api/deliverables/[id]/status                  | Update status              | STRATEGIST+   |
| POST   | /api/approvals                                 | Create approval request    | STRATEGIST+   |
| POST   | /api/approvals/[id]/respond                    | Client responds            | CLIENT_ADMIN  |
| POST   | /api/files/upload                              | Upload file                | Any internal  |
| GET    | /api/reports/[clientId]/monthly                | Monthly report             | STRATEGIST+   |
| GET    | /api/clients/[id]/agenda                       | List agenda items          | STRATEGIST+   |
| POST   | /api/clients/[id]/agenda                       | Create agenda item         | STRATEGIST+   |
| PATCH  | /api/clients/[id]/agenda/[itemId]              | Update agenda item         | STRATEGIST+   |
| DELETE | /api/clients/[id]/agenda/[itemId]              | Delete agenda item         | STRATEGIST+   |
| POST   | /api/clients/[id]/strategy/bulk                | Bulk create strategy items | STRATEGIST+   |
| DELETE | /api/clients/[id]/strategy/bulk                | Delete strategy items      | STRATEGIST+   |
| GET    | /api/clients/[id]/strategy/document            | Get strategy doc           | STRATEGIST+   |
| POST   | /api/clients/[id]/strategy/document            | Create/upsert strategy doc | STRATEGIST+   |
| PUT    | /api/clients/[id]/strategy/document            | Update strategy doc        | STRATEGIST+   |
| DELETE | /api/clients/[id]/strategy/document            | Delete strategy doc        | STRATEGIST+   |

### 10.2 Endpoints TO BUILD (MVP)

| Method | Endpoint                           | Purpose                    |
|--------|------------------------------------|----------------------------|
| GET    | /api/deliverables/[id]             | Get deliverable detail     |
| PUT    | /api/deliverables/[id]             | Update deliverable         |
| GET    | /api/tasks                         | List tasks (filtered)      |
| POST   | /api/tasks                         | Create task                |
| PUT    | /api/tasks/[id]                    | Update task                |
| DELETE | /api/tasks/[id]                    | Delete task                |
| GET    | /api/contracts                     | List contracts             |
| POST   | /api/contracts                     | Create contract            |
| PUT    | /api/contracts/[id]                | Update contract            |
| PUT    | /api/onboarding/[clientId]         | Update onboarding status   |
| GET    | /api/campaigns                     | List campaigns             |
| POST   | /api/campaigns                     | Create campaign            |
| PUT    | /api/campaigns/[id]                | Update campaign            |
| GET    | /api/activity                      | List activity logs         |

---

## 11. Data Flow: Month-in-the-Life

```
Week 1: Strategy Review
  - Strategist opens /clients/[id]/strategy
  - Reviews wishlist from preparation month
  - Converts top items to Deliverables (IDEA status)
  - Assigns team members

Week 2-3: Outreach & Execution
  - Move deliverables: IDEA -> OUTREACH -> CONFIRMED
  - Create runner assignments for events
  - Send approval requests to client (press releases, proposals)
  - Client approves/revises in portal

Week 4: Wrap & Report
  - Complete deliverables, log outcomes
  - Check pacing bar (target: 6-8)
  - Dashboard shows agency-wide status
  - Generate monthly report for client

Ongoing:
  - Runners check /runners/schedule for weekly assignments
  - Jessica manages contracts in /legal
  - Lori views billing readiness in /reports
  - Clients check portal for wins and approvals
```
