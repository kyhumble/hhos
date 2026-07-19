# Phase 2 — KPI notes & metrics (ids only)

**Purpose:** operational health for the wound-photo pipeline without selecting or logging PHI.

**Rules (non-negotiable):**

- Metrics and dashboards use **resource ids, statuses, counts, durations, role codes** only.  
- **Never** project patient names, DOB, MRN, addresses, free-text diagnosis, geo coordinates, DEKs, ciphertext, or image bytes.  
- Application logs already follow the same rule (`requestId`, `orgId`, `actorUserId`, `photoId`, `episodeId`, `deviceId`, `status`, `errorCode`, `latencyMs`).  
- Prefer aggregate SQL / scheduled reports over ad-hoc exports.  

Source definitions: `docs/architecture/phase-2-secure-wound-photos.md` → Observability → KPIs.

---

## KPI catalog

| KPI | Definition | Primary source | Notes |
|-----|------------|----------------|-------|
| Consent compliance | Completes with valid purpose assert / initiate attempts | `audit_events` (`wound_photo.upload_complete` vs `wound_photo.initiate`) + error codes | Failures: `CONSENT_*` on photo ops |
| Upload success rate | `available / (available + failed + abandoned)` | `wound_photos.status` | Org-scoped; exclude soft_deleted from denominator or report separately |
| Sync lag | `uploaded_at − captured_at` for `available` | `wound_photos` | p50/p95; device clock skew possible |
| Pending abandonment | Count `pending_*` older than TTL / status `abandoned` | `wound_photos`, orphan GC | Compare to `photoPendingTtlHours` (default 24) |
| Geotag rate | Fraction of available photos with non-null geo | `wound_photos.geo_lat IS NOT NULL` | Expect ~0 when defaults off; **do not** select lat/lng values in reports |
| Large-wound task open time | Time open → done for `large_wound_review` | `clinical_tasks` | HITL only |
| View rate by role | Count of `wound_photo.view` / `view_break_glass` by actor role | `audit_events` | Break-glass should be rare and reason-audited |
| Decrypt busy / 503 rate | `DECRYPT_BUSY` responses / content requests | API metrics / logs | Concurrent decrypt limit |

---

## Example SQL (admin / ops — synthetic or BAA-covered envs only)

All queries return **counts, ids, timestamps, enums**. Adjust schema/column names if migrations rename fields.

### Upload success by org (last 7 days)

```sql
-- ids / status counts only
SELECT
  org_id,
  status,
  count(*)::bigint AS n
FROM wound_photos
WHERE created_at >= now() - interval '7 days'
  AND deleted_at IS NULL
GROUP BY org_id, status
ORDER BY org_id, status;
```

### Sync lag distribution (available photos)

```sql
SELECT
  org_id,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY extract(epoch FROM (uploaded_at - captured_at))
  ) AS lag_seconds_p50,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY extract(epoch FROM (uploaded_at - captured_at))
  ) AS lag_seconds_p95,
  count(*)::bigint AS n
FROM wound_photos
WHERE status = 'available'
  AND uploaded_at IS NOT NULL
  AND captured_at IS NOT NULL
  AND uploaded_at >= now() - interval '7 days'
GROUP BY org_id;
```

### Pending / abandoned backlog

```sql
SELECT
  org_id,
  status,
  count(*)::bigint AS n,
  min(created_at) AS oldest_created_at
FROM wound_photos
WHERE status IN ('pending_upload', 'pending_put', 'failed', 'abandoned')
GROUP BY org_id, status;
```

### Geotag rate (boolean only — no coordinates)

```sql
SELECT
  org_id,
  count(*) FILTER (WHERE geo_lat IS NOT NULL)::bigint AS with_geo,
  count(*)::bigint AS total_available,
  round(
    100.0 * count(*) FILTER (WHERE geo_lat IS NOT NULL) / nullif(count(*), 0),
    2
  ) AS pct_with_geo
FROM wound_photos
WHERE status = 'available'
GROUP BY org_id;
```

### Large-wound open tasks (ids only)

```sql
SELECT
  id AS task_id,
  org_id,
  episode_id,
  patient_id,
  wound_photo_id,
  status,
  priority,
  created_at
FROM clinical_tasks
WHERE task_type = 'large_wound_review'
  AND status IN ('open', 'in_progress')
ORDER BY created_at ASC
LIMIT 500;
```

### View / break-glass volume (audit)

```sql
-- Assumes action + actor fields; no before/after PHI payloads
SELECT
  org_id,
  action,
  count(*)::bigint AS n
FROM audit_events
WHERE action IN ('wound_photo.view', 'wound_photo.view_break_glass')
  AND created_at >= now() - interval '7 days'
GROUP BY org_id, action;
```

### Device revoke / register events

```sql
SELECT
  org_id,
  action,
  count(*)::bigint AS n
FROM audit_events
WHERE action IN ('device.register', 'device.revoke')
  AND created_at >= now() - interval '30 days'
GROUP BY org_id, action;
```

---

## Runtime / admin notes

| Signal | Where today | PHI-safe? |
|--------|-------------|-----------|
| Orphan GC summary log | `OrphanGcService` — counts of photos/annotations abandoned, tasks backfilled | Yes (counts) |
| Decrypt concurrency | `decrypt-limit.ts` metrics hook | Yes |
| Wrap rate limit | in-process per-user bucket | Yes |
| Feature flags | `FEATURE_WOUND_PHOTOS`, annotations, large-wound tasks | N/A |

**Future (not MVP):** authenticated admin metrics endpoint returning the same aggregates; Prometheus counters with org_id label only (no patient labels).

---

## Smoke checklist (synthetic data)

Use demo users only. Confirm **ids/status** in UI/API — never paste photo bytes into tickets.

1. `FEATURE_WOUND_PHOTOS=true`, `PHOTO_KEK` set, MinIO up, migrate + seed.  
2. Register device → capture (camera path) → sync → photo `available`.  
3. Web episode gallery: metadata list; open one image via `/content`.  
4. Billing user: no photo content.  
5. Revoke consent → clinical content denied; compliance break-glass with reason audited.  
6. Large measurement → `large_wound_review` task open.  
7. Pending older than TTL → orphan GC marks `abandoned` (counts in log).  
