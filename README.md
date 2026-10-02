# Gmail Rules Installer V3.1

A Gmail rules installer and inventory scanner for reorganizing a high-volume mailbox.

## Inventory

Copy `credentials.json` and your authorized `token.json` into the project directory.

```powershell
npm install
npm run inventory:big
```

The big inventory scans up to 10,000 non-trash/non-spam messages from the last 24 months. It uses concurrency limiting, pauses between batches, exponential retry/backoff for Gmail quota errors, and a local checkpoint.

If interrupted, run the same command again and it resumes from `inventory-checkpoint.json`.

For an even gentler scan:

```powershell
node inventory.js --months=24 --max=10000 --concurrency=2 --delay=500
```

Generated inventory/checkpoint files and OAuth credentials are excluded by `.gitignore`.
