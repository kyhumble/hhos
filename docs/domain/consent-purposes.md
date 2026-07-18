# Consent Types & Purpose Codes

## Consent types (MVP)

| Type | Description |
|------|-------------|
| `HIPAA_NPP` | Notice of Privacy Practices acknowledgment |
| `ADMISSION` | Admission / treatment consent |
| `WOUND_PHOTO` | Clinical photography consent with purpose limitation |
| `ROI` | Release of information |
| `FINANCIAL` | Financial responsibility / assignment of benefits |
| `TELEHEALTH` | Reserved |
| `RESEARCH` | Reserved — never mix with Medicare HH claims |

## Purpose codes

| Code | Description |
|------|-------------|
| `TREATMENT` | Care delivery |
| `PAYMENT` | Billing |
| `HOPS` | Healthcare operations |
| `WOUND_PHOTO_CLINICAL` | Capture/store/view clinical wound images |
| `WOUND_PHOTO_QA` | Internal QA / QAPI review |
| `WOUND_PHOTO_TEACHING` | De-identified teaching only if separately granted |
| `SHARE_PHYSICIAN` | Share with ordering physician |
| `SHARE_PAYER` | Share with payer for payment |
| `MARKETING` | Default deny; separate opt-in only |

## Rules

- Signing freezes template `version` + `body_sha256`.  
- Revocation never deletes history.  
- Phase 2 photo capture requires active `WOUND_PHOTO_CLINICAL`.  

**Legal text in seeds is PLACEHOLDER — NOT LEGAL FINAL.**
