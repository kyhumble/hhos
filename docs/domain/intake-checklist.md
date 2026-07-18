# Intake Checklist Codes

| Code | Required | Notes |
|------|----------|-------|
| `DEMOGRAPHICS_COMPLETE` | Y | Name, DOB |
| `SERVICE_ADDRESS` | Y | Service location |
| `PRIMARY_COVERAGE` | Y | Rank-1 coverage |
| `COVERAGE_VERIFIED` | Org setting | Denial risk if skipped |
| `NPP_ACK` | Y | HIPAA NPP |
| `ADMISSION_CONSENT` | Y | |
| `PHOTO_CONSENT` | Y if wound pathway | Gate for Phase 2 photos |
| `ROI` | Optional | |
| `FINANCIAL` | Y | |
| `F2F_STATUS_KNOWN` | Y | Not `unknown` |
| `ORDERS_STATUS_KNOWN` | Y | Not `missing` |
| `PRIMARY_DX_PRESENT` | Warn | PDGM-critical later |
| `HISTORY_STARTED` | Warn | Allergies/meds |
| `SURROGATE_DOCUMENTED` | If capacity impaired | |

## Completeness score (MVP weights)

Demographics+address 15 · Coverage 15 · Core consents 25 · Photo consent 10 · History 10 · F2F 10 · Orders 10 · Primary dx 5  

`ready_for_soc` when all **required** items complete.
