import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

export function initializeUI(context: vscode.ExtensionContext): SidebarProvider {
    const sidebarProvider = new SidebarProvider(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "codemind.sidebarView",
            sidebarProvider
        )
    );

    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = "$(hubot) CodeMind: Ready";
    statusBar.show();
    context.subscriptions.push(statusBar);

    return sidebarProvider;
}
