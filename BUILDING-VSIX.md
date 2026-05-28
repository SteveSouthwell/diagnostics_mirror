# Building a .vsix Package

This document explains how to build this extension into a `.vsix` file that can be installed in VS Code.

## Prerequisites

- Node.js 18+ (or current LTS)
- npm
- Dependencies installed in this project

## 1. Open a terminal at project root

Example path:

`C:\apps2\diagnostics_mirror`

## 2. Install dependencies

```powershell
npm install
```

## 3. Package into .vsix

Use the project script:

```powershell
npm run package
```

After this command succeeds, a file like `diagnostics-mirror-0.0.1.vsix` is created in the project root.

Before sharing publicly, set real values for `repository`, `bugs`, and `homepage` in `package.json`.

## 4. Install the .vsix locally

Option A: VS Code UI

1. Open Extensions view.
2. Select the `...` menu.
3. Choose `Install from VSIX...`.
4. Pick the generated `.vsix` file.

Option B: CLI

```powershell
code --install-extension .\diagnostics-mirror-0.0.1.vsix
```

## 5. Direct vsce command (alternative)

If you prefer not to use the npm script, run:

```powershell
npx @vscode/vsce package
```

Or, after `npm install` has completed in this project:

```powershell
npx vsce package
```

## Troubleshooting

- `Manifest is not valid`:
  - Check required fields in `package.json` (`name`, `displayName`, `version`, `publisher`, `engines.vscode`, `main`).
- `Publisher name is invalid`:
  - For Marketplace publishing, `publisher` must be a valid publisher ID (typically lowercase, no spaces).
  - This project uses `sesouthwell` as a valid package identifier.
- Missing compiled output:
  - Ensure `npm run compile` succeeds and that `out/extension.js` exists.
- `vsce` not found:
  - Use `npm run package` (preferred) or `npx @vscode/vsce package`.
- Packaging asks `Do you want to continue? [y/N]`:
  - Ensure `repository` metadata is present and valid in `package.json`.

## Notes

- This project already includes a `vscode:prepublish` script, so `vsce package` triggers compilation automatically.
- `npm run package` calls `vsce package` and runs `vscode:prepublish` first.
- The generated `.vsix` is suitable for local installation and sharing outside the Marketplace.
