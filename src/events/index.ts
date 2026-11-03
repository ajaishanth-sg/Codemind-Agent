import * as vscode from 'vscode';

export function initializeEvents(context: vscode.ExtensionContext) {
    // Listen for file saves, git events, etc.
    let saveListener = vscode.workspace.onDidSaveTextDocument((doc) => {
        // TODO: Trigger incremental analysis
    });

    context.subscriptions.push(saveListener);
}
