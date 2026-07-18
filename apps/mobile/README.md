# HHOS Field (`@hhos/mobile`)

Expo Router field app for home-health wound care (synthetic data only in non-prod).

## Phase 2 requirement: prebuild / dev client (not Expo Go)

**Expo Go is unsupported** for Phase 2 photo capture builds.

Clinical encryption uses **`react-native-quick-crypto`** (AES-256-GCM) and an app-controlled camera (`expo-camera`). Those need native modules that are **not** available in the store Expo Go client.

Use one of:

```bash
# From apps/mobile (or via pnpm filter)
pnpm --filter @hhos/mobile exec expo prebuild
pnpm --filter @hhos/mobile exec expo run:ios
# or
pnpm --filter @hhos/mobile exec expo run:android
```

Or an **EAS development build** / custom dev client.

### Modules (Phase 2)

| Area | Path | Notes |
|------|------|--------|
| Consent gate | `src/consent/` | Blocks `/capture` without `WOUND_PHOTO_CLINICAL` |
| Camera | `src/camera/` | **`expo-camera` only** — no `expo-image-picker` / gallery |
| JPEG normalize | `src/camera/normalize-jpeg.ts` | Max edge 2048, quality ~0.8, ≤ 12 MB |
| AES-GCM | `src/crypto/aes-gcm.ts` | `react-native-quick-crypto`; framing matches `PHOTO_CRYPTO_VECTORS` |
| Outbox | `src/outbox/` | sqlite metadata + FS ciphertext; DEK in Secure Store |

### What works without a dev client

- Dev login → JWT in **expo-secure-store** (`hhos.accessToken`)
- Caseload **episodes** list (`GET /v1/episodes`) when token present
- **Consent purpose cache** + hard block on `/capture` without `WOUND_PHOTO_CLINICAL`

Camera, encrypt, and outbox require prebuild. `expo-secure-store` works in Expo Go, but do not rely on Expo Go for Phase 2 field photo workflows.

## Secure Store key layout (locked)

| Key | Contents |
|-----|----------|
| `hhos.accessToken` | JWT |
| `hhos.deviceId` | App install UUID (later PR) |
| `hhos.consent-grant.{patientId}` | Clinical purpose grant cache (IDs only) |
| `hhos.photo-dek.{clientPhotoId}` | Per-photo DEK (base64) until sync wipe |
| `hhos.annot-dek.{clientAnnotationId}` | Annotation DEK (later) |

**Outbox layout:** `photo_outbox` rows in `expo-sqlite` (IDs/status/hashes only — no DEKs, names, or geo). Ciphertext files under app document dir `photo-cipher/{clientPhotoId}.bin`. Concurrent pending photos use **distinct** Secure Store keys.

Never log token or DEK values. Consent cache TTL: **7 days**.

### Logout / revoke known

- **Logout** clears `hhos.accessToken` and all known `hhos.consent-grant.*` entries (via a secure-store index).
- Online `active-purposes` **without** `WOUND_PHOTO_CLINICAL` **clears** that patient's grant cache and denies capture (no stale cache).
- Only true **transport offline** (or non-authoritative 5xx) may use a non-expired cached grant.
- HTTP **401 / 403 / 404** never fall back to cache.


## Dev login

1. Start API (`pnpm --filter @hhos/api dev`).
2. Set `EXPO_PUBLIC_API_URL` if not `http://localhost:3001` (use your machine LAN IP for a physical device).
3. Sign in with a demo user, e.g. `rn@demo.local`.
4. Episodes load from the API; capture route refreshes `active-purposes` and caches `WOUND_PHOTO_CLINICAL` when present.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter @hhos/mobile dev` | Expo start (shell / secure store only in Expo Go) |
| `pnpm --filter @hhos/mobile typecheck` | TypeScript check |
| `pnpm --filter @hhos/mobile test` | Gate classifiers + AES-GCM vector tests vs shared fixtures |

## Hard rules

- No gallery import for clinical wound photos (`expo-image-picker` is not a dependency).
- No capture without active / cached `WOUND_PHOTO_CLINICAL`.
- Encrypt before outbox enqueue completes; DEK never in sqlite.
- No PHI in logs.
