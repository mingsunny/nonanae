# Prototype Plan: Trip Bill Settlement App

> Fill in each section as you go. Sections marked (later) can stay blank until you're closer to building.

## 1. Problem & Goal
- **Problem statement:** After a trip with friends, settling shared expenses is complicated — spending is uneven across members, not everyone is part of every expense, and settling up often means many separate back-and-forth payments instead of a clean, minimal set of transfers.
- **Why now:** TBD — capture the specific trigger (recent trip pain point, etc.) if there's one worth recording.
- **Success looks like:** A group can log all trip expenses and get back a settlement plan with the minimum number of payments needed to fully settle everyone up — no manual math, no redundant payments.

## 2. Target User
- **Primary user:** Someone organizing or participating in a group trip with friends (small-to-medium group, e.g. 2–15 people).
- **User need in one sentence:** I want to track shared trip expenses and know exactly who should pay whom, without doing the math myself or overpaying/underpaying.
- **How they solve this today (workaround/competitor):** Splitwise, spreadsheets, or manually tallying via Venmo/KakaoPay requests — which often results in redundant payments (e.g. A pays B, B pays C, when A could've just paid C directly).

## 3. Scope (MVP)
- **Must have (v0):**
  - Log in (with sign-up as a secondary flow reachable from the log-in screen, not the first thing a user sees)
  - Create a trip (name, optional trip dates) — inspired by `Group_1.png` but simplified: every group is a trip, so there's no group-type selector
  - Add friends to a trip via message or shareable invite link, available any time from the trip screen — not a forced step at creation (see design decision below) — inspiration: `Group_3.png`
  - Add an expense: amount, who paid (payer can pay on behalf of others), who the bill is split among (independent of full group membership) — ref: `Info_1.png`
  - Choose split method per expense — equal, manual/exact amount, percentage, or shares — entered inline on the add-expense screen itself, not a separate step (see design decision below) — ref: `Split Option_1.png`, `Split Option_2.png`, `Split Option_3.png`
  - Notify all group members once everyone has finished entering expenses
  - Settlement summary: minimum-transaction "who pays whom how much" breakdown, plus per-person total spent/paid — ref: `Minimum_1.png`, `Minimum_2.png`
  - Bottom navigation: **Trips**, **Activity** (notifications), **Profile** — persistent on the three top-level tabs; detail screens (a specific trip, add expense, settlement, etc.) use their own back navigation instead
- **Design decisions made during prototyping (diverging from the reference screenshots on purpose — see Design Principles, section 6):**
  - No group-type selector (Trip/Home/Couple/Other) — this app only does trips, so that step was cut for simplicity
  - Inviting friends is not gated to trip creation — it's a persistent "+ Invite" action on the trip screen, since the full group often isn't known yet when a trip is created
  - "Mark yourself done" adding expenses is one-way — no "mark as not done" toggle, to keep the status simple and avoid accidental flip-flopping
  - Split method (equal/exact/percent/shares) is chosen inline on the add-expense screen with live-updating per-person amounts, instead of a separate "Split Options" screen — cuts one full navigation step out of the most-used flow in the app
  - First screen is Log In, not Sign Up — matches the common case (returning user) and treats new-account creation as the secondary path
- **Nice to have (later):**
  - Group home / itinerary view — inspiration: `Group_2.png`
- **Explicitly out of scope:**
  - Actual payment processing/integration (Venmo, Zelle, KakaoPay, etc.) — MVP shows the plan, doesn't move money
  - Multi-currency support
  - Receipt photo scanning / OCR
  - Recurring/non-trip expense groups
  - Expense edit history / audit log

## 4. Core User Flow
1. User logs in (or signs up first, via a secondary screen, if new)
2. User creates a trip (name, optional dates) — lands directly on the trip screen, no forced invite step
3. Whenever ready, user invites friends via link or message from the trip screen (optional, can be done later or skipped entirely if adding expenses solo first)
4. Friends join the trip
5. Throughout the trip, members add expenses — amount, payer(s), who splits it, and the split method (equal / exact / percentage / shares) chosen inline on the same screen, with live-updating per-person amounts
6. Each member marks themselves done adding expenses (one-way); once all members are done, the group gets notified
7. App computes and displays the minimal settlement plan (who pays whom, how much) plus per-person totals

## 5. Key Screens / Components
- [ ] Log-in screen (primary/first screen)
- [ ] Sign-up screen — reachable via a link from log-in, not the first screen
- [ ] **Trips tab** (top-level, bottom nav) — list of the user's trips with at-a-glance balance
- [ ] Create trip screen — inspired by `Group_1.png`, simplified (no type selector)
- [ ] Invite friends screen (invite link + message invite, member list) — inspiration: `Group_3.png`; reachable any time via "+ Invite" on the trip screen
- [ ] Trip screen (members, expenses list, entry point to add expense / view settlement) — inspiration: `Group_2.png`
- [ ] Add expense screen — amount, payer selection, split-participant selection, and split method (equal / exact amount / percentage / shares) with live per-person amounts, all on one screen — ref: `Info_1.png`, `Split Option_1.png`, `Split Option_2.png`, `Split Option_3.png`
- [ ] Settlement summary screen (minimized who-pays-whom list + per-person totals) — ref: `Minimum_1.png`, `Minimum_2.png`
- [ ] **Activity tab** (top-level, bottom nav) — notifications list
- [ ] **Profile tab** (top-level, bottom nav) — account info, log out

## 6. Design Principles
- **Simple:** Every screen should ask for the minimum input needed to move forward. No optional settings surfaced by default — advanced options (percentage/shares split, trip dates, etc.) stay one tap away, not front and center.
- **Consistent:** The same interaction patterns repeat everywhere they apply — e.g. the person-picker (avatar + checkbox) used to add friends, select payers, and select split participants should look and behave identically across screens. One color/shape language for state (selected/unselected, paid/unpaid, settled/unsettled) throughout the app.
- **Thoughtful interaction:** Design each interaction, not just each screen — e.g. running totals update live as amounts are entered (as in `Split Option_1.png`'s "$0.00 of $10.00, $10.00 left"), tapping an avatar toggles selection with immediate visual feedback, destructive/irreversible actions (leaving a group, deleting an expense) require confirmation.
- **Plain English:** No financial or technical jargon in UI copy. Say "Who paid" not "Payer allocation," "Split between" not "Participant subset," "You owe" / "You're owed" not "Net balance." Copy should be understandable to someone who has never used a bill-splitting app.

## 7. Tech Stack
Two-phase plan:
- **Phase 1 — click-through prototype (now):** Static HTML/CSS + vanilla JS, hardcoded/fake data, no backend. Goal is to validate flow and feel with a coworker, not to be reused as production code.
  - **Frontend:** Plain HTML/CSS/JS (no framework, no build step)
  - **Backend / API:** None — hardcoded data in JS
  - **Data storage:** None
  - **Auth:** None (mocked sign-up screen only)
  - **Hosting / deploy target:** Open locally in browser, or a simple static host if a shareable link is needed
  - **Third-party services / APIs:** None
- **Phase 2 — full-blown prototype (later):** Not decided yet. Depends on decisions not yet made (native mobile app vs. web, App Store distribution, etc.) — to be revisited once Phase 1 validates the flow.

## 8. Data Model (rough)
- **User**: id, name, contact info, auth credentials
- **Group**: id, name, start_date, end_date, members[] (every group is a trip — no separate type field)
- **GroupMember**: user_id, group_id, status (invited/joined)
- **Expense**: id, group_id, amount, created_by, note (optional)
- **ExpensePayer**: expense_id, user_id, amount_paid (supports one or more payers per expense, incl. paying on someone else's behalf)
- **ExpenseSplit**: expense_id, user_id, amount_owed, split_type (equal/manual/percentage/shares)
- **Settlement**: group_id, from_user, to_user, amount (computed from balances via min-cash-flow, not persisted long-term)
- **Relationship:** A Group has many GroupMembers and Expenses. Each Expense has one or more ExpensePayers and one or more ExpenseSplits. Settlement is derived, not stored, by netting each member's (total paid − total owed) and greedily matching the largest creditor with the largest debtor until all balances are zero — this minimizes the number of payment transactions.

## 9. Open Questions / Risks
- **Technical risk:** Confirm the min-cash-flow settle-up algorithm (net balances, then greedily match max creditor ↔ max debtor) matches expectations from the `Minimum_1.png`/`Minimum_2.png` reference — those show 5 transactions for 6 people, worth validating against the underlying balances.
- **Design/UX risk:** None open — all four split types (equal, exact amount, percentage, shares) are confirmed for v0.
- **Unknowns to resolve before building:**
  - What happens if a member never marks their expenses "done" — does settlement wait indefinitely, or is there a manual trigger/deadline?
  - Exact plain-English labels for the two-column payer/split-participant picker in the add-expense screen (`Info_1.png` shows this as 결제/함께 — two separate checkbox columns for "who paid" vs "who's included in the split").
  - Is a manual "mark as settled" confirmation enough for MVP, given payment execution is out of scope?
  - Tech stack decision (mobile vs. web) — needed before building starts.

## 10. Milestones
| Milestone | Target date | Notes |
|---|---|---|
| Skeleton/plan done | 2026-08-24 | this doc |
| Core flow working end-to-end | | |
| Demo-able prototype | | |
| Feedback round | | |

## 11. Next Steps
- [ ] Decide tech stack (mobile vs. web)
- [ ] Flesh out data model into an actual schema
- [ ] Build core flow: sign up → create group → invite → add expense → settle
