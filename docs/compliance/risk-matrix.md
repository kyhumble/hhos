# Risk Matrix (initial)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Real PHI used in dev | Med | Critical | Synthetic seeds; policy; env separation |
| Local JWT left on in prod | Low | Critical | Env gate + CI check |
| Offline sync data loss (Phase 2) | Med | High | Idempotent outbox; retry/backoff; orphan GC |
| Gallery photo bypass (Phase 2) | Med | High | Camera-only clinical capture; `capture_source` enforced (K1) |
| Capture without consent | Med | Critical | `assertConsentPurpose`; cached grant rules; K16 on view |
| Lost device plaintext photos | Med | High | Encrypt-before-rest; DEK wipe after sync; device revoke |
| Public bucket / wrong S3 host | Low | Critical | Private ACL; dual clients; no signed-URL host rewrite |
| PHOTO_KEK shared with field key | Low | High | Separate env keys (K4); inventory + rotation notes |
| AI over-automation | Med | High | HITL required; logged accept/reject |
| Outdated OASIS definitions (Phase 3) | Med | High | Version pin; compliance freeze |
| Scope creep beyond intake+photos | High | Med | MVP cut Phases 0–2 |
| Consent wording not legally reviewed | High | High | NOT LEGAL FINAL markers; counsel review |

See `docs/compliance/threat-model-v0.md` for the full Phase 2 photo threat table.
