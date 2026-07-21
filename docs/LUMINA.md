# Lumina

**The AI-native operating system for home-based care.**

*Clarity for every visit. Intelligence for every decision.*

Lumina is the product vision and long-term identity for this codebase (HHOS). HHOS provides the solid, HIPAA-by-design, multi-tenant foundation (intake, episodes, visits, OASIS-E, PDGM awareness, orders/e-sign, hospice, billing readiness, offline field mobile, consents, audit, RLS). Lumina is how we make it **far more technologically advanced**, **dramatically easier and more beautiful to use**, and a true rival (and superior alternative) to Homecare HomeBase.

## Positioning vs Homecare HomeBase (HCHB)

HCHB is comprehensive and mature. Clinicians and agencies frequently cite high documentation burden, steep learning curves, laggy performance, and a functional but dated interface.

Lumina goals:
- 50–70% reduction in active documentation time via ambient multimodal AI + adaptive forms (human-in-the-loop review/approve).
- Consumer-grade calm UI (teal/indigo, generous space, progressive disclosure, dark mode perfection) so new clinicians are productive in <30 minutes.
- True offline-first mobile with excellent iOS/Android parity and wearable companions.
- Predictive risk scores (hospitalization, falls, LUPA, decline) and multi-objective intelligent scheduling that factor clinician well-being.
- Deep RPM + patient/family companion app that drives engagement and outcomes.
- FHIR-native trajectory + TEFCA readiness.
- Revenue-cycle automation that reduces denials while remaining fully auditable.
- Workforce tools that reduce burnout (load balancing, micro-learning, recognition).

All AI remains human-in-the-loop. Every suggestion carries provenance and is audited. Compliance (CoPs, OASIS accuracy, PDGM, EVV, HIPAA, consent) stays first-class and invisible on the happy path.

## Core Pillars

1. **Ambient Multimodal AI** — Conversation + observation + photo + device data → structured draft notes, OASIS candidates, coding support. Clinician reviews in minutes, not 20–40.
2. **Beautiful, Calm, Effortless Interface** — Soft teal/indigo palette, progressive disclosure, role-tailored home screens, micro-interactions that delight without distracting.
3. **True Offline-First + Edge Intelligence** — Full core workflows offline; intelligent sync; on-device inference where privacy/latency benefit.
4. **Predictive & Proactive** — Risk scores and insights surface before the clinician opens the chart; scheduling optimizes continuity + equity + energy.
5. **Patient Partnership** — Consumer-grade app with live ETA, progress rings, personalized education, family tools.
6. **Revenue & Compliance Automation** — AI-assisted PDGM/OASIS, denial prediction, F2F/POC tracking, survey-ready packaging — always with human sign-off and full lineage.

## Mapping to Existing HHOS Phases

| Lumina Capability                  | Current HHOS Foundation                          | Next Build Steps                                      |
|------------------------------------|--------------------------------------------------|-------------------------------------------------------|
| Intake & SOC tracking              | Referrals, consents, SOC windows, multi-tenant   | AI extraction from referrals, richer eligibility     |
| Clinical documentation             | Visits, OASIS, clinical tasks                    | Ambient draft + SuggestionCard + adaptive forms      |
| Scheduling / Routing               | Ops routing scorer, field tasks                  | Multi-objective optimizer + burnout signals          |
| Orders / Physician sign            | Phase 5 packages + magic link                    | Deeper AI medical-necessity linkage                  |
| Hospice                            | Phase 6                                          | HOPE support + comfort pathways                      |
| Billing readiness                  | Phase 7                                          | Predictive denial + claim scrub                      |
| Secure media                       | Phase 2 photo pipeline                           | Generalize to clinical media; AI measurement assist  |
| AI HITL                            | Phase 4 Service AI (planned)                     | Expand to ambient, risk scores, explainable cards    |
| Patient engagement                 | Minimal                                          | New patient portal / companion app                   |
| Workforce / credentials            | Orgs, users, permissions                         | License/competency tracking (CredTrak patterns)      |

## Design Principles (UI)

- Calm Technology: information appears when needed.
- Zero-to-hero usability: guided, contextual, never overwhelming.
- Human + AI partnership: transparent confidence, easy "why this?", always editable.
- Mobile-first with desktop parity and offline indicators that feel trustworthy.
- Accessibility and inclusion first (WCAG, multi-language, low-literacy modes).

## Implementation Guardrails (from AGENTS.md + Lumina)

- AI never auto-finalizes clinical or billing decisions.
- Full provenance + audit on every AI suggestion and human action.
- Consent gates for ambient capture and media.
- No PHI in logs; synthetic data only in non-prod.
- Feature flags for progressive rollout of advanced AI.

## Near-Term Build Priorities

1. Design system elevation (teal/indigo calm aesthetic + dark mode + SuggestionCard).
2. Shared AI types + provenance model + audit extension.
3. Stub ambient / suggestion endpoints wired into Visit and OASIS flows (mocked → real models later).
4. Clinician Day View / Focus Mode polish on web + mobile.
5. Basic patient-facing engagement surface.
6. Credential / competency tracking for workforce matching.

This document is the living product north star. Update it as we ship. All code changes should demonstrably move HHOS closer to the Lumina experience while preserving the rigorous compliance foundation already in place.

---

*Last updated: 2026-07-21 — Team synthesis of product vision + existing HHOS implementation.*
