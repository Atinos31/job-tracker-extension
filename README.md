# Job Tracker

A local-first Chrome extension for saving job listings, tracking application progress and follow-ups, and exporting your records.

## Features

- Save a job from the current page with best-effort title and company extraction. All details remain editable.
- Track saved and applied dates, status changes, follow-up dates, next actions, and notes.
- Search and filter applications, see follow-ups due in the next seven days, and edit records in the dashboard.
- Open a Gmail search for an application's company and role without granting the extension inbox access.
- Export the filtered list as CSV, create a JSON backup, or merge records from a backup.

## Run locally

1. Install dependencies with `npm install`.
2. Build the extension with `npm run build`.
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select this project's `dist` directory.

After making code changes, rebuild and reload the extension from `chrome://extensions`.

## Data and privacy

Application records are stored in the browser's `chrome.storage.local`. The extension does not send records to a server. Page details are read only for the active tab when you open the extension popup, using the `activeTab` and `scripting` permissions. Restricted browser pages may not allow extraction; you can still enter the details manually.

Use **Download backup** to save a JSON copy of your records. **Import backup** validates the file and merges new records without replacing existing ones; entries with a matching ID or job URL are skipped. Keep backups somewhere safe, since they may contain private job-search information.

## Development

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks and builds the extension.
- `npm run lint` runs ESLint.
