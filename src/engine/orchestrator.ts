import * as vscode from 'vscode';
import * as path from 'path';
import { GraphDatabase } from './graph/db';
import { TypeScriptAnalyzer } from './analyzers/typescript';
import { SidebarProvider } from '../ui/SidebarProvider';

export class CodeMindOrchestrator {
    private db: GraphDatabase | null = null;
    private context: vscode.ExtensionContext;
    private sidebarProvider?: SidebarProvider;

    constructor(context: vscode.ExtensionContext, sidebarProvider?: SidebarProvider) {
        this.context = context;
        this.sidebarProvider = sidebarProvider;
    }

    public async scanWorkspace() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('CodeMind: No workspace folder opened.');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const storagePath = this.context.globalStorageUri.fsPath;

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "CodeMind: Scanning Workspace...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Initializing Database..." });
                
                if (!this.db) {
                    this.db = new GraphDatabase(storagePath);
                }

                progress.report({ increment: 30, message: "Parsing TypeScript files..." });
                
                const tsAnalyzer = new TypeScriptAnalyzer(workspaceRoot, this.db);
                await tsAnalyzer.analyze();

                const stats = this.db.getStats();

                progress.report({ increment: 100, message: "Done!" });
                vscode.window.showInformationMessage(`CodeMind: Workspace scan complete. Project Graph updated.`);
                
                if (this.sidebarProvider) {
                    this.sidebarProvider.sendMessageToWebview('response', `✅ **Scan Complete**\nI've successfully indexed the project architecture into the Fact Brain.\n\n- Nodes (Files/Functions): ${stats.nodes}\n- Edges (Dependencies): ${stats.edges}`);
                }
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`CodeMind Scan Failed: ${error.message}`);
        }
    }

    public dispose() {
        if (this.db) {
            this.db.close();
        }
    }
}
