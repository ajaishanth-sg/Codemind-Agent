import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { initializeEvents } from './events';
import { initializeUI } from './ui';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeMind is now active!');

    // Initialize layers
    const sidebarProvider = initializeUI(context);
    registerCommands(context, sidebarProvider);
    initializeEvents(context);
}

export function deactivate() {
    console.log('CodeMind deactivated.');
}
