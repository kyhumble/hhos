# Risk Matrix (initial)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Real PHI used in dev | Med | Critical | Synthetic seeds; policy; env separation |
| Local JWT left on in prod | Low | Critical | Env gate + CI check |
| Offline sync data loss (Phase 2) | Med | High | Idempotent events; conflict UI |
| Gallery photo bypass (Phase 2) | Med | High | Camera-only clinical capture |
| AI over-automation | Med | High | HITL required; logged accept/reject |
| Outdated OASIS definitions (Phase 3) | Med | High | Version pin; compliance freeze |
| Scope creep beyond intake+photos | High | Med | MVP cut Phases 0–2 |
| Consent wording not legally reviewed | High | High | NOT LEGAL FINAL markers; counsel review |
