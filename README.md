# Kevilton Warranty Letter Generator

A web application for generating formatted **Kevilton Electrical Products (Pvt.) Ltd.** warranty declaration letters and PO-based warranty certificates with instant live preview, smart product catalog search, automatic warranty rule matching, and one-click **PDF** and **Word (`.docx`)** export.

---

## Features

- **Two Official Letter Formats**
  - **1. Common Draft Warranty Certificate** — Warranty declaration letter with dynamic `Warranty Declaration for [Product Brand]` subject line synced with selected items.
  - **2. Common Warranty Certificate** — Purchase Order (PO) based certificate referencing the customer's PO number in the subject and opening body.
- **Smart Product Catalog Autocomplete & Auto-Fill**
  - Loads product data from `public/data/items.json` with graceful fallback to manual entry if the catalog is unavailable.
  - Multi-word token search across item code (including tail digits such as `0559`), item description, category, sub-category, and matched product brand.
  - Displays all matching results in a scrollable dropdown with a sticky match counter and relevance ranking (exact/tail code matches first, followed by description and multi-token matches).
  - Selecting a suggestion automatically populates **Product Description**, **Product Brand**, and **Warranty Period** for that row while keeping all fields editable.
- **Automated Warranty Classification (`warrantyRules.ts`)**
  - Evaluates catalog items through a prioritized rule engine covering Switch & Socket series (Lifetime / 5 Years for USB, Shaver Socket, and Hotel Key Card), Protection Devices (MCB, RCCB, MCCB, Isolator, Hexa, Safetaa, SPD, Changeover), Lighting & LED (2–3 Years), Electrical Accessories (6 Months / 1 Year), Fans, and Solar Tubular Batteries.
- **Print-Ready Live Preview & Document Export**
  - Clean US Letter (`8.5" × 11"`), 1-inch margins, Times New Roman typography, and plain bordered tables without decorative clutter.
  - Export directly to **PDF** (`jsPDF` + `jspdf-autotable`) or editable **Microsoft Word (`.docx`)** (`docx`).
- **Smooth Form UX**
  - Multi-row item management (`+ Add Row` / remove row) with completely independent search states.
  - Smooth auto-scroll and focus on the first invalid required field when validation fails.
  - Full browser **Back / Forward** history synchronization between the form and live preview while preserving entered data.
- **Automated Excel Price List Sync**
  - Python sync script (`scripts/sync_items.py`) and GitHub Actions workflow (`.github/workflows/sync-price-list.yml`) to keep `public/data/items.json` up to date directly from the hosted Excel price list.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Document Generation:** `jspdf`, `jspdf-autotable`, `docx`
- **Catalog Sync Automation:** Python 3.11, `openpyxl`, GitHub Actions

---

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── sync-price-list.yml          # GitHub Action to sync Excel price list to items.json
├── public/
│   └── data/
│       └── items.json                   # Auto-synced product catalog used by autocomplete
├── scripts/
│   └── sync_items.py                    # Downloads & parses Excel workbook into items.json
├── src/
│   ├── components/
│   │   ├── CertificateSelectionPage.tsx # Live letter preview & PDF/DOCX download screen
│   │   ├── FeatureBadges.tsx            # Feature highlights section
│   │   ├── Header.tsx                   # Top navigation bar
│   │   ├── KeviltonLogo.tsx             # Brand logo component
│   │   ├── ProductDescriptionAutocomplete.tsx # Multi-token relevance-ranked search input
│   │   └── WarrantyForm.tsx             # Main form, dynamic item rows & validation
│   ├── utils/
│   │   ├── cleanPdfGenerator.ts         # Clean PDF generator & shared table/subject helpers
│   │   ├── docxGenerator.ts             # Clean Word (.docx) generator
│   │   ├── templateParser.ts            # Date formatting, address parsing & PO subject logic
│   │   └── warrantyRules.ts             # Product brand & warranty period matching rules
│   ├── App.tsx                          # App state, view switching & browser history sync
│   ├── main.tsx                         # React entry point
│   └── types.ts                         # Shared TypeScript interfaces
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (and `npm`)
- **Python 3.11+** (optional, only needed if running the Excel catalog sync script locally)

### Installation & Local Development

```bash
# Install dependencies
npm install

# Start the development server (runs on http://localhost:3000)
npm run dev
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server on port `3000`. |
| `npm run build` | Builds the production bundle into `dist/`. |
| `npm run preview` | Previews the production build locally. |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`). |
| `npm run clean` | Removes build artifacts (`dist/`). |

---

## Automated Price List Sync

The product autocomplete reads from `public/data/items.json`, which can be refreshed automatically from the master `.xlsx` price list:

### 1. Via GitHub Actions (Recommended)
- **Manual run:** Open the **Actions** tab → select **Sync Price List** → click **Run workflow**.
- **Issue trigger:** Open a new GitHub Issue titled exactly `sync-price-list`. The workflow downloads the latest `.xlsx`, updates `public/data/items.json` if changed, commits and pushes it, comments with the total synced item count, and automatically closes the issue.
- **Custom URL override:** Optionally configure a repository secret named `PRICE_LIST_URL` in **Settings → Secrets and variables → Actions** to point to a different direct `.xlsx` download URL.

### 2. Locally via Python

```bash
pip install openpyxl
PRICE_LIST_URL="https://your-direct-xlsx-download-url" python scripts/sync_items.py
```

---

## Deployment

This project is a standard Vite SPA and deploys directly to **Vercel**, **Netlify**, or any static hosting provider:

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
