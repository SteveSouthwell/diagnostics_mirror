# Changelog

All notable changes to this project are documented in this file.

## 0.0.5 - 2026-05-28

- Fixed an issue where `all-problems.json` could include files with empty `diagnostics` arrays after problems were cleared.
- `all-problems.json` now includes only files that currently have one or more diagnostics.

## 0.0.4 - 2026-05-28

- Updated manifest metadata to the canonical project location at `https://github.com/SteveSouthwell/diagnostics_mirror`.
- Removed unused `@types/node` development dependency to reduce dependency footprint.
- Confirmed `package-lock.json` is tracked for reproducible dependency resolution.

## 0.0.3 - 2026-05-28

- Added debounce and change-detection logic to reduce unnecessary file writes.
- Adjusted write behavior so all-problems updates from diagnostics changes, while current-file follows active editor + diagnostics updates.

## 0.0.2 - 2026-05-28

- Added license metadata and root LICENSE file.
- Added VSIX build documentation.

## 0.0.1 - 2026-05-28

- Initial extension implementation.
- Added diagnostics mirroring into `.ai/problems/current-file.json` and `.ai/problems/all-problems.json`.
