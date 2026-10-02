# Gmail Rules Installer

Node.js tooling for turning a high-volume Gmail account into an
**attention-oriented inbox**.

> Messages requiring attention stay in Inbox. Routine records are labeled and
> archived. Rules should be driven by observed mailbox data rather than guesses.

## What this repository does

There are two main workflows:

1. **Inventory** a large mailbox sample to learn which senders and subject
   patterns generate the most mail.
2. **Install Gmail filters** from a declarative rule set, with backup/restore
   support around configuration changes.

Current version: **V3.1**

## Important V3.1 limitation

The installer does **not yet detect filters previously installed by this
project**. Repeatedly running `npm run apply` may create duplicate Gmail
filters.

Until managed-filter/duplicate detection is implemented, treat `apply` as an
installation/migration operation rather than an idempotent command.

## Setup

Requirements:

- Node.js with ES module support.
- Google Cloud OAuth client with Gmail API enabled.
- Local `credentials.json`.

Install dependencies:

```powershell
npm install
```

Authentication is centralized in `auth.js`. The requested scopes are:

- `gmail.settings.basic` - manage Gmail filters.
- `gmail.labels` - inspect/create labels.
- `gmail.readonly` - search messages and read From/Subject metadata.

An earlier version used `gmail.metadata`, but Gmail does not permit the
`messages.list` `q` search parameter with metadata-only authorization.

If scopes change later, deleting `token.json` forces reauthorization.

## Security / files that never belong in Git

The following are intentionally ignored:

```text
credentials.json
token.json
sender-inventory.json
sender-inventory.csv
inventory-checkpoint.json
gmail-filter-backup*.json
node_modules/
```

The inventory contains mailbox-derived information. Treat it as private data.

## Inventory

Normal scan:

```powershell
npm run inventory
```

Defaults: last 12 months, maximum 5,000 messages, concurrency 3, 250 ms delay.

Large scan:

```powershell
npm run inventory:big
```

This scans up to 10,000 non-Trash/non-Spam messages from the last 24 months.

Gentler version if Gmail throttles heavily:

```powershell
node inventory.js --months=24 --max=10000 --concurrency=2 --delay=500
```

### Why the scanner intentionally pauses

A previous high-concurrency implementation hit Gmail's per-user
**Total Query Cost** quota.

V3.1 therefore uses low concurrency, inter-batch delays, exponential backoff,
and checkpointing. The pauses are intentional; removing them can make the whole
job slower once Gmail begins throttling requests.

### Resume behavior

Progress lives in:

```text
inventory-checkpoint.json
```

The checkpoint stores IDs plus already-retrieved From/Subject metadata. It is
reused when the query and maximum-message setting match the current run.

So if a 10,000-message run stops at 7,050, rerunning the same command resumes
instead of starting the metadata work from zero.

Delete the checkpoint when you intentionally want a fresh inventory.

### Output

A completed scan creates:

```text
sender-inventory.json
sender-inventory.csv
```

Each sender contains a normalized email address, message count, and up to eight
distinct sample subjects.

The scanner does not download message bodies or attachments.

## Gmail filter installer

Policy lives in `rules.js`; Gmail API mechanics live in
`gmail-organizer.js`.

A rule looks like:

```js
{
  name: "Payment confirmations",
  label: "Finance/Payments",
  query: "subject:(...)",
  archive: true,
  important: false
}
```

- `archive: true` removes Gmail's `INBOX` label.
- `important: true` adds Gmail's `IMPORTANT` label.
- Gmail filters are independent, so a message may match multiple rules.

Preview:

```powershell
npm run plan
```

Backup:

```powershell
npm run backup
```

Apply:

```powershell
npm run apply
```

Apply automatically takes a backup before mutation.

Restore preview:

```powershell
npm run restore
```

Actual destructive filter restore:

```powershell
node gmail-organizer.js --restore --yes
```

Restore deletes the current filter set and recreates the backed-up filters.
Labels are captured in the backup for reference but V3.1 does not destructively
replace/delete Gmail labels.

## Mailbox architecture

Intended label hierarchy:

- `Action/` - time-sensitive or exception messages kept visible.
- `Finance/` - routine financial records normally archived.
- `Purchases/` - orders, shipping, and receipts normally archived.
- `Services/` - routine service reports.
- `Low Priority/` - automated information not requiring attention.

The governing idea is **Inbox = attention required**.

## File map

| File | Purpose |
| --- | --- |
| `auth.js` | OAuth scopes, token reuse, interactive authentication. |
| `inventory.js` | Quota-aware mailbox inventory and sender aggregation. |
| `rules.js` | Declarative Gmail filtering policy. |
| `gmail-organizer.js` | Plan, backup, apply, and restore operations. |
| `package.json` | Dependencies and convenience scripts. |
| `.gitignore` | Keeps credentials/private/generated data out of Git. |

## Planned improvements

1. Analyze `sender-inventory.json` for sender-specific rules.
2. Add exact duplicate detection before filter creation.
3. Track filters managed by this project so upgrades are idempotent.
4. Detect/flag overlapping rules.
5. Back up current state immediately before destructive restore.
6. Preserve/migrate earlier rules instead of installing equivalents twice.

## Two-years-later checklist

If you have completely forgotten how this project works:

1. Read this README.
2. `git pull`
3. `npm install`
4. Confirm local `credentials.json` exists. **Never commit it.**
5. Run `npm run plan` before changing Gmail.
6. For fresh statistics, delete the old checkpoint and run
   `npm run inventory:big`.
7. Inspect `sender-inventory.json`.
8. Run `npm run backup` before manual experimentation.
9. Do not repeatedly run `npm run apply` until duplicate detection exists.
10. For OAuth scope problems, delete `token.json` and authorize again.

That should provide enough context to return to the project without reconstructing
its history from Git archaeology.
