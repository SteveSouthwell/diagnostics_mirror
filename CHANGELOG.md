# Changelog

All notable changes to this project are documented in this file.

## 0.0.3 - 2026-05-28

- Added debounce and change-detection logic to reduce unnecessary file writes.
- Adjusted write behavior so all-problems updates from diagnostics changes, while current-file follows active editor + diagnostics updates.

## 0.0.2 - 2026-05-28

- Added license metadata and root LICENSE file.
- Added VSIX build documentation.

## 0.0.1 - 2026-05-28

- Initial extension implementation.
- Added diagnostics mirroring into `.ai/problems/current-file.json` and `.ai/problems/all-problems.json`.
