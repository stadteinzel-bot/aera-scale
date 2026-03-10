# AERA SCALE — Projekt-Kontext

## Live-URL
**https://aera-scale-983360724436.europe-west1.run.app/**

## Projekt-Überblick
AERA SCALE ist eine Immobilienverwaltungs-SaaS (React + TypeScript + Vite, deployed auf Google Cloud Run).
Multi-Tenant: jede Organisation (`orgId`) hat isolierte Daten in Firestore.

## Tech-Stack
| Schicht | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite (PWA) |
| Hosting | Google Cloud Run (`europe-west1`) |
| Datenbank | Firebase Firestore |
| Auth | Firebase Authentication |
| Datei-Speicher | Firebase Storage (`gs://aera-scale-documents`) |
| Backend Functions | Cloud Functions for Firebase (Node 20) |
| KI | Vertex AI (Gemini) |
| Open Banking | Tink API |

## GCP Projekt
- **Project ID:** `aera-scale`
- **Project Number:** `983360724436`
- **Region:** `europe-west1`

## Deploy-Befehle
```bash
# App (Cloud Run)
npm run build
gcloud run deploy aera-scale --source . --region europe-west1 --quiet

# Firebase (Firestore Rules + Indexes + Storage Rules)
firebase deploy --only firestore,storage

# Nur Cloud Functions
firebase deploy --only functions
```

## Cloud Functions
| Funktion | Zweck |
|---|---|
| `deleteAccount` | Org-Kündigung / Nutzer-Löschung |
| `tinkCreateLink` | Open Banking Link erstellen |
| `tinkHandleCallback` | Tink OAuth Callback |
| `tinkSyncTransactions` | Transaktionen synchronisieren |

## Firebase Storage Buckets
- **Genutzt von App:** `gs://aera-scale-documents` (EUROPE-WEST1, CORS konfiguriert)
- **Firebase Default:** `gs://aera-scale.firebasestorage.app`
- Beide Buckets haben dieselben Security Rules (in `firebase.json` konfiguriert)

## Storage Quota per Organisation
| Plan | Speicher |
|---|---|
| Basic (Standard) | **1 GB** |
| Pro | 50 GB |
| Enterprise | Unbegrenzt |
- Definiert in: `services/storageQuota.ts`
- Backend-Enforcement: `storage.rules`

## Wichtige Dateien
| Datei | Zweck |
|---|---|
| `App.tsx` | Haupteinstiegspunkt, Auto-Landing auf erste Immobilie |
| `components/AssetOverview.tsx` | Immobilien-Detailseite mit Hero-Banner |
| `components/AssetLayout.tsx` | Layout mit Sidebar-Navigation |
| `components/Documents.tsx` | Dokumentenverwaltung mit Upload/Quota |
| `components/Settings.tsx` | Einstellungen inkl. Speicherplan |
| `services/storageQuota.ts` | Quota-Logik (check, record, format) |
| `services/firebaseConfig.ts` | Firebase-Konfiguration |
| `services/dataService.ts` | Alle Firestore/Storage CRUD-Operationen |
| `firestore.rules` | Firestore Security Rules |
| `storage.rules` | Storage Security Rules |
| `firestore.indexes.json` | Composite-Indexes (14 Stk.) |
| `firebase.json` | Firebase Deploy-Konfiguration |

## Bekannte Eigenheiten
- PWA Service-Worker kann alten Code cachen → bei Tests: Hard Refresh (Ctrl+Shift+R)
- `firebase.json`: `indexes` muss **innerhalb** des `firestore`-Objekts stehen (nicht auf Root-Ebene)
- Storage Rules müssen auf **beiden** Buckets deployed werden (in `firebase.json` als Array konfiguriert)
- App landet direkt auf der ersten Immobilien-Detailseite nach Login (kein Dashboard)
