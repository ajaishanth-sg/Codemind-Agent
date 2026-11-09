import { machineIdSync } from "node-machine-id";
import * as URI from "uri-js";
import * as vscode from "vscode";

export function translate(range: vscode.Range, lines: number): vscode.Range {
  return new vscode.Range(
    range.start.line + lines,
    range.start.character,
    range.end.line + lines,
    range.end.character,
  );
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getExtensionUri(): vscode.Uri {
  return vscode.extensions.getExtension("Continue.continue")!.extensionUri;
}

export function getViewColumnOfFile(
  uri: vscode.Uri,
): vscode.ViewColumn | undefined {
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (
        (tab?.input as any)?.uri &&
        URI.equal((tab.input as any).uri, uri.toString())
      ) {
        return tabGroup.viewColumn;
      }
    }
  }
  return undefined;
}

export function getRightViewColumn(): vscode.ViewColumn {
  // When you want to place in the rightmost panel if there is already more than one, otherwise use Beside
  let column = vscode.ViewColumn.Beside;
  const columnOrdering = [
    vscode.ViewColumn.One,
    vscode.ViewColumn.Beside,
    vscode.ViewColumn.Two,
    vscode.ViewColumn.Three,
    vscode.ViewColumn.Four,
    vscode.ViewColumn.Five,
    vscode.ViewColumn.Six,
    vscode.ViewColumn.Seven,
    vscode.ViewColumn.Eight,
    vscode.ViewColumn.Nine,
  ];
  for (const tabGroup of vscode.window.tabGroups.all) {
    if (
      columnOrdering.indexOf(tabGroup.viewColumn) >
      columnOrdering.indexOf(column)
    ) {
      column = tabGroup.viewColumn;
    }
  }
  return column;
}

export function openEditorAndRevealRange(
  uri: vscode.Uri,
  range?: vscode.Range,
  viewColumn?: vscode.ViewColumn,
  preview: boolean = false,
): Promise<vscode.TextEditor> {
  return new Promise((resolve) => {
    vscode.workspace.openTextDocument(uri).then(
      async (doc) => {
        try {
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn:
              getViewColumnOfFile(uri) || viewColumn || vscode.ViewColumn.One,
            preview: false,
          });
          if (range) {
            editor.revealRange(range);
          }
          resolve(editor);
        } catch (err) {
          console.warn("Error showing text document:", err);
          resolve(undefined as any);
        }
      },
      (err) => {
        console.warn("Error opening text document:", err);
        resolve(undefined as any);
      },
    );
  });
}

export function getUniqueId() {
  const id = vscode.env.machineId;
  if (id === "someValue.machineId") {
    return machineIdSync();
  }
  return vscode.env.machineId;
}
