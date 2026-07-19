# Threat Model v0 (Phase 0–2)

Living document. Phase 0–1 baseline plus **Phase 2 wound photo pipeline** threats. See also `docs/architecture/phase-2-secure-wound-photos.md` (Security & Privacy Considerations, Key Decisions K1 / K16).

## Assets

- Patient demographics, coverage, clinical history  
- Consent records and signature artifacts  
- **Wound photographs** (ciphertext objects + catalog metadata + measurements)  
- Photo DEKs (transient on device; wrapped at rest in Postgres)  
- Device registration / revocation state  
- Credentials and session tokens  
- Audit logs (integrity)  

## Actors

- Field RN, intake coordinator, clinical lead, billing, compliance, admin  
- External: referrers, payers (later), attackers, lost/stolen devices  
- Compromised or revoked mobile installs  

## Top threats (MVP horizon)

1. **Unauthorized access to patient records** — mitigate with RBAC, caseload scope, MFA  
2. **Tampering with consents or audit** — append-only audit; frozen template hashes  
3. **Data exfiltration via logs/APM** — no PHI logging; scrubbers (`redact.ts` includes DEK/geo keys)  
4. **Insecure object storage** — private buckets; short-lived presigned PUT; **no public ACL**; ciphertext only  
5. **Lost mobile device** — encrypt-before-rest; local DEK wipe after sync; remote **device revoke** (PR 5a/API); short tokens  
6. **Insider misuse** — audit every photo view; break-glass reason codes; concurrent decrypt limit; least privilege  

## Phase 2 — photo pipeline threats

| # | Threat | Severity | Mitigations (implemented / required) |
|---|--------|----------|--------------------------------------|
| T1 | **Gallery / camera-roll as clinical source** | High | **Camera-only** clinical capture (`capture_source = app_camera` only; no `expo-image-picker` clinical path). K1. |
| T2 | **Capture or upload without consent** | Critical | `assertConsentPurpose(..., WOUND_PHOTO_CLINICAL)` on initiate, complete, and clinical content view; cached grant offline only after online fetch. |
| T3 | **Lost device with plaintext photos** | High | AES-256-GCM encrypt before outbox rest; DEK in Secure Store; wipe DEK + cipher file after `available`; revoke → local wipe. |
| T4 | **Public bucket / leaked download URL** | Critical | Private MinIO/S3; ciphertext objects; **decrypt-proxy only** (`GET .../content`); no presigned GET for clinical view in MVP. |
| T5 | **Presign PUT replay / wrong host** | High | Short TTL; authz at issue; dual clients (`S3_ENDPOINT` vs `S3_PUBLIC_ENDPOINT`); never rewrite signed URL hosts (K25). |
| T6 | **Insider bulk exfil via viewer** | High | `wound_photo:read` (billing **denied**); caseload scope; audit every view; max concurrent decrypts. |
| T7 | **PHI / DEK / geo in logs** | High | Log ids + status/error codes only; redact DEK/geo/image payloads. |
| T8 | **View after consent revoke** | High | **K16**: clinical path re-asserts purpose and **denies** after revoke/expiry; compliance **break-glass** only (`BREAK_GLASS_PHI` + reason; audit `view_break_glass`). No field_rn break-glass. |
| T9 | **MITM of upload path** | Med | TLS; only ciphertext leaves the device. |
| T10 | **DEK exposure on wrap endpoint** | Med | TLS; single-use wrap; no body logging; wrap rate limit. |
| T11 | **Annotation overwrites clinical truth** | Med | Non-destructive side-car + **child DEK** per annotation. |
| T12 | **Geotag privacy** | Med | Fail-closed dual gate (`PHOTO_GEOTAG_ENABLED` explicit + org setting); role-filtered read. |
| T13 | **Third-party SDK / storage subprocessor** | High | Minimize SDK surface; BAA inventory before prod PHI (AWS S3/KMS; no real PHI in local MinIO). |
| T14 | **Unregistered or revoked device uploads** | High | Active device register required on photo ops; `DEVICE_NOT_REGISTERED` / `DEVICE_REVOKED`; revoke is **not** deferred to hardening PR (PR 5a). |
| T15 | **Billing / document:read dual path** | High | Content routes accept **only** `wound_photo:read`; never `document:read` (K15). |

### Camera-only (K1) — non-negotiable

Clinical wound photos are captured **only** via an app-controlled camera. Gallery pick is never a clinical source of truth. Server enforces `captureSource: 'app_camera'`.

### Consent & post-revocation view (K16)

1. Capture stores `purpose_at_capture = WOUND_PHOTO_CLINICAL` and a verified `consent_record_id`.  
2. Normal clinical view re-asserts that purpose for the same patient/consent.  
3. After revoke/expiry → deny normal view.  
4. Compliance may use break-glass with reason; audited; purpose assert skipped.  

### Encrypt / device controls (summary)

| Control | Detail |
|---------|--------|
| Encrypt-before-upload | Per-object DEK (AES-256-GCM); `PHOTO_KEK` wraps DEK server-side (separate from `FIELD_ENCRYPTION_KEY`) |
| Device gate | Register before sync; revoked devices blocked on initiate/wrap/complete |
| Soft-delete | Leads/compliance soft-delete `available`; field RN may abandon own pending only |
| Feature flag | `FEATURE_WOUND_PHOTOS` master switch |

## Out of scope for v0 deep dive

- Full STRIDE per component (expand as pilot nears)  
- Penetration test findings (pre-prod gate)  
- Multi-org CMK isolation (Phase 2.1+)  
- Offline consent capture outbox (Phase 2.1)  
