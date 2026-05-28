# Diagnostics Mirror

This extension mirrors VS Code diagnostics (Problems panel) into files in your workspace:

- `.ai/problems/current-file.json`
- `.ai/problems/all-problems.json`

The files are updated automatically with these rules:

- `.ai/problems/all-problems.json` updates when diagnostics change, is debounced, and is only rewritten when the diagnostics content actually changes.
- `.ai/problems/current-file.json` updates when diagnostics change and when you switch the active editor.

In multi-root workspaces, each root folder gets its own mirror folder and files.

## Command

- `Diagnostics Mirror: Refresh Now`

## Settings

Use VS Code Settings and search for `Diagnostics Mirror`.

- `diagnosticsMirror.enabled`:
	- Turn mirroring on or off.
- `diagnosticsMirror.outputFolder`:
	- Relative path where mirror files are written inside each workspace root.
	- Default: `.ai/problems`.
- `diagnosticsMirror.allProblemsDebounceMs`:
	- Delay before writing `all-problems.json` after diagnostics events.
	- Default: `1000`.
- `diagnosticsMirror.mirrorCurrentFile`:
	- Enable or disable writing `current-file.json`.

## Why

External AI coding agents can read these files to understand the latest compiler and linter issues without direct VS Code APIs.

## Privacy And Data Behavior

- This extension writes local files only.
- It does not send data to any external service.
- Written data includes diagnostic text, severity, source/rule codes, ranges, and file paths for items reported by VS Code diagnostics providers.

## Known Limitation

`all-problems.json` can only include diagnostics that VS Code providers have emitted. Some language tools report only open-file diagnostics unless a project-wide lint/build task has run.
