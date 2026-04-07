# TODOS

## Product

### V1.2 Trip Brief Comments

**What:** Add comment threads to shared trip briefs with minimal moderation baseline.

**Why:** Votes show preference, but comments capture reasoning and can reduce route decision back-and-forth.

**Context:** V1.1 intentionally shipped share+vote only for scope control; comments were explicitly deferred during plan review after architecture and abuse-surface evaluation.

**Effort:** M
**Priority:** P2
**Depends on:** V1.1 share+vote release and first-cohort metrics stability

### Vote Anti-Brigading Hardening

**What:** Add anomaly detection for suspicious voting patterns beyond baseline token/rate-limit protections.

**Why:** Coordinated abuse can still distort tallies and reduce trust even with signed tokens and atomic writes.

**Context:** V1.1 includes baseline safeguards (signed voter token, one-vote-per-brief token, rate limits, atomic mutation). This task is defense-in-depth after real traffic patterns emerge.

**Effort:** M
**Priority:** P2
**Depends on:** Meaningful post-launch vote volume and observed abuse signals

### Route Decision Analytics Dashboard

**What:** Build a lightweight dashboard for shortlist time, decision-lock time, and vote funnel metrics by trip brief.

**Why:** Speeds up post-release product learning and helps make clearer V1.2 prioritization decisions.

**Context:** V1.1 plan already defines telemetry event schema and attribution rules; this task builds the reporting layer once event volume is sufficient.

**Effort:** M
**Priority:** P3
**Depends on:** V1.1 telemetry events in production and initial cohort data collection

## Completed
