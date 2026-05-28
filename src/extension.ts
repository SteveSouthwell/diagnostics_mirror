import * as vscode from "vscode";

type DiagnosticRecord = {
  owner: string;
  severity: "Error" | "Warning" | "Information" | "Hint";
  code?: string;
  source?: string;
  message: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
};

type FileDiagnostics = {
  file: string;
  diagnostics: DiagnosticRecord[];
};

type ProblemsPayload = {
  generatedAt: string;
  workspaceFolder: string;
  files: FileDiagnostics[];
  summary: {
    files: number;
    total: number;
    errors: number;
    warnings: number;
    information: number;
    hints: number;
  };
};

type MirrorSettings = {
  enabled: boolean;
  outputFolder: string;
  allProblemsDebounceMs: number;
  mirrorCurrentFile: boolean;
};

const DEFAULT_OUTPUT_FOLDER = ".ai/problems";
const MIN_DEBOUNCE_MS = 100;

let allProblemsWriteTimer: ReturnType<typeof setTimeout> | undefined;
const lastPayloadSignatureByFile = new Map<string, string>();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      const settings = readSettings();
      if (!settings.enabled) {
        return;
      }

      scheduleAllProblemsSnapshot(settings);
      if (settings.mirrorCurrentFile) {
        void writeCurrentFileSnapshots();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      const settings = readSettings();
      if (!settings.enabled || !settings.mirrorCurrentFile) {
        return;
      }

      void writeCurrentFileSnapshots();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("diagnosticsMirror")) {
        return;
      }

      const settings = readSettings();
      if (!settings.enabled) {
        clearAllProblemsTimer();
        return;
      }

      scheduleAllProblemsSnapshot(settings);
      if (settings.mirrorCurrentFile) {
        void writeCurrentFileSnapshots();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("diagnosticsMirror.refreshNow", async () => {
      const settings = readSettings();
      if (!settings.enabled) {
        void vscode.window.showInformationMessage("Diagnostics Mirror is disabled in settings.");
        return;
      }

      clearAllProblemsTimer();
      await Promise.all([
        writeAllProblemsSnapshots(true),
        settings.mirrorCurrentFile ? writeCurrentFileSnapshots(true) : Promise.resolve()
      ]);
      void vscode.window.showInformationMessage("Diagnostics mirror refreshed.");
    })
  );

  const initialSettings = readSettings();
  if (initialSettings.enabled) {
    scheduleAllProblemsSnapshot(initialSettings);
    if (initialSettings.mirrorCurrentFile) {
      void writeCurrentFileSnapshots();
    }
  }
}

export function deactivate(): void {
  clearAllProblemsTimer();
}

function clearAllProblemsTimer(): void {
  if (allProblemsWriteTimer) {
    clearTimeout(allProblemsWriteTimer);
    allProblemsWriteTimer = undefined;
  }
}

function scheduleAllProblemsSnapshot(settings: MirrorSettings): void {
  clearAllProblemsTimer();

  allProblemsWriteTimer = setTimeout(() => {
    allProblemsWriteTimer = undefined;
    void writeAllProblemsSnapshots();
  }, settings.allProblemsDebounceMs);
}

async function writeAllProblemsSnapshots(forceWrite = false): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return;
  }

  const settings = readSettings();
  const allDiagnostics = vscode.languages.getDiagnostics();

  await Promise.all(
    folders.map(async (folder) => {
      const diagnosticsForFolder = allDiagnostics.filter(([uri]) => {
        const uriFolder = vscode.workspace.getWorkspaceFolder(uri);
        return uriFolder?.uri.toString() === folder.uri.toString();
      });

      const mirrorDir = getMirrorDir(folder.uri, settings.outputFolder);
      const allProblemsFile = vscode.Uri.joinPath(mirrorDir, "all-problems.json");
      const allPayload = buildPayload(folder.uri.fsPath, diagnosticsForFolder);

      await writePayloadIfChanged(mirrorDir, allProblemsFile, allPayload, forceWrite);
    })
  );
}

async function writeCurrentFileSnapshots(forceWrite = false): Promise<void> {
  const settings = readSettings();
  if (!settings.mirrorCurrentFile) {
    return;
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const activeFolder = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;

  await Promise.all(
    folders.map(async (folder) => {
      const diagnosticsForFolder =
        activeUri && activeFolder?.uri.toString() === folder.uri.toString()
          ? ([[activeUri, vscode.languages.getDiagnostics(activeUri)] as const] satisfies ReadonlyArray<
              readonly [vscode.Uri, readonly vscode.Diagnostic[]]
            >)
          : [];

      const mirrorDir = getMirrorDir(folder.uri, settings.outputFolder);
      const currentFileProblemsFile = vscode.Uri.joinPath(mirrorDir, "current-file.json");
      const currentPayload = buildPayload(folder.uri.fsPath, diagnosticsForFolder);

      await writePayloadIfChanged(mirrorDir, currentFileProblemsFile, currentPayload, forceWrite);
    })
  );
}

function getMirrorDir(folderUri: vscode.Uri, outputFolder: string): vscode.Uri {
  const segments = outputFolder.split("/").filter((segment) => segment.length > 0);
  return segments.length > 0 ? vscode.Uri.joinPath(folderUri, ...segments) : folderUri;
}

async function writePayloadIfChanged(
  mirrorDir: vscode.Uri,
  targetFile: vscode.Uri,
  payload: ProblemsPayload,
  forceWrite: boolean
): Promise<void> {
  const signature = buildPayloadSignature(payload);
  const key = targetFile.toString();

  if (!forceWrite && lastPayloadSignatureByFile.get(key) === signature) {
    return;
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.createDirectory(mirrorDir);
  await vscode.workspace.fs.writeFile(targetFile, encoder.encode(JSON.stringify(payload, null, 2)));

  lastPayloadSignatureByFile.set(key, signature);
}

function buildPayload(
  workspaceFolder: string,
  diagnosticsByUri: ReadonlyArray<readonly [vscode.Uri, readonly vscode.Diagnostic[]]>
): ProblemsPayload {
  let total = 0;
  let errors = 0;
  let warnings = 0;
  let information = 0;
  let hints = 0;

  const files: FileDiagnostics[] = diagnosticsByUri.map(([uri, diagnostics]) => {
    const mapped = diagnostics.map((diagnostic) => {
      const severity = toSeverityLabel(diagnostic.severity);
      total += 1;

      switch (severity) {
        case "Error":
          errors += 1;
          break;
        case "Warning":
          warnings += 1;
          break;
        case "Information":
          information += 1;
          break;
        case "Hint":
          hints += 1;
          break;
      }

      const code =
        typeof diagnostic.code === "string" || typeof diagnostic.code === "number"
          ? String(diagnostic.code)
          : diagnostic.code?.value !== undefined
            ? String(diagnostic.code.value)
            : undefined;

      return {
        owner: diagnostic.source ?? "unknown",
        severity,
        code,
        source: diagnostic.source,
        message: diagnostic.message,
        range: {
          start: {
            line: diagnostic.range.start.line + 1,
            character: diagnostic.range.start.character + 1
          },
          end: {
            line: diagnostic.range.end.line + 1,
            character: diagnostic.range.end.character + 1
          }
        }
      } as DiagnosticRecord;
    });

    mapped.sort(compareDiagnosticRecord);

    return {
      file: uri.fsPath,
      diagnostics: mapped
    };
  });

  files.sort((a, b) => a.file.localeCompare(b.file));

  return {
    generatedAt: new Date().toISOString(),
    workspaceFolder,
    files,
    summary: {
      files: files.length,
      total,
      errors,
      warnings,
      information,
      hints
    }
  };
}

function buildPayloadSignature(payload: ProblemsPayload): string {
  return JSON.stringify({
    workspaceFolder: payload.workspaceFolder,
    files: payload.files,
    summary: payload.summary
  });
}

function compareDiagnosticRecord(a: DiagnosticRecord, b: DiagnosticRecord): number {
  return (
    a.range.start.line - b.range.start.line ||
    a.range.start.character - b.range.start.character ||
    a.range.end.line - b.range.end.line ||
    a.range.end.character - b.range.end.character ||
    severityRank(a.severity) - severityRank(b.severity) ||
    (a.code ?? "").localeCompare(b.code ?? "") ||
    (a.source ?? "").localeCompare(b.source ?? "") ||
    (a.owner ?? "").localeCompare(b.owner ?? "") ||
    a.message.localeCompare(b.message)
  );
}

function severityRank(severity: DiagnosticRecord["severity"]): number {
  switch (severity) {
    case "Error":
      return 0;
    case "Warning":
      return 1;
    case "Information":
      return 2;
    case "Hint":
      return 3;
    default:
      return 4;
  }
}

function toSeverityLabel(severity: vscode.DiagnosticSeverity): DiagnosticRecord["severity"] {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "Error";
    case vscode.DiagnosticSeverity.Warning:
      return "Warning";
    case vscode.DiagnosticSeverity.Information:
      return "Information";
    case vscode.DiagnosticSeverity.Hint:
      return "Hint";
    default:
      return "Information";
  }
}

function readSettings(): MirrorSettings {
  const config = vscode.workspace.getConfiguration("diagnosticsMirror");

  const enabled = config.get<boolean>("enabled", true);
  const mirrorCurrentFile = config.get<boolean>("mirrorCurrentFile", true);
  const outputFolder = normalizeOutputFolder(config.get<string>("outputFolder", DEFAULT_OUTPUT_FOLDER));
  const debounce = config.get<number>("allProblemsDebounceMs", 1000);
  const allProblemsDebounceMs =
    Number.isFinite(debounce) && debounce >= MIN_DEBOUNCE_MS
      ? Math.floor(debounce)
      : MIN_DEBOUNCE_MS;

  return {
    enabled,
    outputFolder,
    allProblemsDebounceMs,
    mirrorCurrentFile
  };
}

function normalizeOutputFolder(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return DEFAULT_OUTPUT_FOLDER;
  }

  const withoutLeadingDotSlash = trimmed.replace(/^\.\/+/, "");
  const withoutLeadingSlash = withoutLeadingDotSlash.replace(/^\/+/, "");
  const withoutTrailingSlash = withoutLeadingSlash.replace(/\/+$/, "");
  const collapsed = withoutTrailingSlash.replace(/\/{2,}/g, "/");

  return collapsed || DEFAULT_OUTPUT_FOLDER;
}
