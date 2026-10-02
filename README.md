# Gmail Rules Installer

Node.js tooling for turning a high-volume Gmail account into an
**attention-oriented inbox**.

> Messages requiring attention stay in Inbox. Routine records are labeled and
> archived. Rules should be driven by observed mailbox data rather than guesses.

## Current version: V4

V4's major change is **idempotent filter installation**. The installer
normalizes the desired Gmail criteria/action and compares it with the filters
already present in Gmail. Exact matches print `EXISTS` / `SKIP`; they are not
created again.

This fixes V3.1's most important limitation: repeated `npm run apply` no longer
creates exact duplicate project filters.

## Setup

Requirements: Node.js, a Google Cloud OAuth client with Gmail API enabled, and
local `credentials.json`.

```powershell
npm install
```

OAuth scopes in `auth.js`:

- `gmail.settings.basic` — manage Gmail filters.
- `gmail.labels` — inspect/create labels.
- `gmail.readonly` — search messages and read From/Subject metadata.

If scopes change, delete `token.json` to force reauthorization.

## Private files — never commit

`credentials.json`, `token.json`, `sender-inventory.json`,
`sender-inventory.csv`, `inventory-checkpoint.json`,
`gmail-filter-backup*.json`, and `node_modules/` are ignored.

## Inventory

```powershell
npm run inventory
npm run inventory:big
```

The large scan covers up to 10,000 non-Trash/non-Spam messages from the last
24 months. The scanner retrieves only From/Subject metadata, uses low
concurrency + exponential backoff, and checkpoints to
`inventory-checkpoint.json`.

Gentler API usage:

```powershell
node inventory.js --months=24 --max=10000 --concurrency=2 --delay=500
```

Outputs are `sender-inventory.json` (preferred for analysis) and
`sender-inventory.csv`.

## Filter workflow

Rules live in `rules.js`; Gmail mechanics live in `gmail-organizer.js`.

### 1. Always plan first

```powershell
npm run plan
```

V4 prints each rule as:

- `EXISTS` — Gmail already has the exact criteria/action.
- `CREATE` — the rule would be created by apply.

Plan is read-only.

### 2. Apply

```powershell
npm run apply
```

Apply first creates `gmail-filter-backup-v4.json`, reuses existing labels,
skips exact existing filters, and creates only missing filters.

### 3. Backup manually

```powershell
npm run backup
```

### 4. Restore

Preview:

```powershell
npm run restore
```

Actual destructive restore:

```powershell
node gmail-organizer.js --restore --yes
```

Because Gmail has no atomic replace-all-filters operation, V4 creates an
additional timestamped **pre-restore safety backup** immediately before deleting
current filters.

## Mailbox architecture

- `Action/` — time-sensitive/exception mail kept visible.
- `Finance/` — routine financial records normally archived.
- `Purchases/` — routine purchase/shipping records normally archived.
- `Services/` — routine service reports.
- `Low Priority/` — automated information not needing attention.

**Inbox = attention required.**

## V4 safety model

Exact duplicate detection compares normalized:

- Filter criteria.
- Added label IDs.
- Removed label IDs.
- Forwarding action, if present.

Label arrays are sorted before comparison because their order is not
semantically meaningful.

V4 deliberately does **not** delete merely similar filters. An old filter may
look redundant but have important historical behavior; migration/deletion
should be explicit rather than inferred.

## Two-years-later checklist

1. Read this README.
2. `git pull`
3. `npm install`
4. Confirm local `credentials.json` exists; never commit it.
5. `npm run plan`
6. `EXISTS` means no duplicate will be installed.
7. For a fresh inventory, delete the old checkpoint and run
   `npm run inventory:big`.
8. Inspect `sender-inventory.json` before adding sender-specific policy.
9. `npm run apply` automatically backs up first.
10. OAuth trouble after a scope change: delete `token.json` and reauthorize.

## Next phase

The completed 10,000-message inventory is the evidence base for expanding V4
with sender-specific classifications. High-confidence promotional senders can
be handled aggressively; mixed senders (security, billing, transactional,
medical, travel, etc.) should use subject-aware rules instead of blanket sender
actions.
