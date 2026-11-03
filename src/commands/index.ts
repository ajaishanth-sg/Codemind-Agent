import * as vscode from 'vscode';
import { CodeMindOrchestrator } from '../engine/orchestrator';
import { GroqReasoner } from '../engine/reasoning/groq';
import { ContextEngine } from '../engine/context';
import { SidebarProvider } from '../ui/SidebarProvider';
import { LLMOrchestrator, fetchProviderModels } from '../engine/reasoning/orchestrator';

import { ToolExecutor } from '../engine/reasoning/executor';

export function registerCommands(context: vscode.ExtensionContext, sidebarProvider?: SidebarProvider) {
    if (sidebarProvider) {
        ToolExecutor.sidebarProvider = sidebarProvider;
    }
    const orchestrator = new CodeMindOrchestrator(context, sidebarProvider);
    const reasoner = new GroqReasoner();

    let scanDisposable = vscode.commands.registerCommand('codemind.scanWorkspace', async () => {
        await orchestrator.scanWorkspace();
    });

    let askDisposable = vscode.commands.registerCommand('codemind.askGroq', async () => {
        const question = await vscode.window.showInputBox({
            prompt: "Ask CodeMind a question",
            placeHolder: "E.g., What does this project do?"
        });

        if (question) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "CodeMind is thinking...",
                cancellable: false
            }, async (progress) => {
                try {
                    const ctx = ContextEngine.getCurrentContext();
                    const answer = await reasoner.askQuestion(question, ctx);
                    vscode.window.showInformationMessage(`CodeMind: ${answer}`, { modal: true });
                } catch (e) {
                    // error handled in reasoner
                }
            });
        }
    });

    let webviewAskDisposable = vscode.commands.registerCommand('codemind.handleWebviewAsk', async (data: any) => {
        if (!sidebarProvider) return;

        if (data.type === 'info') {
            vscode.window.showInformationMessage(data.value);
            return;
        }

        if (data.type === 'fetchModels') {
            const models = await fetchProviderModels(data.provider, data.apiKey, data.baseUrl);
            sidebarProvider.sendMessageToWebview('modelsFetched', { models });
            return;
        }
        
        sidebarProvider.sendMessageToWebview('loading', null);
        
        try {
            const ctx = ContextEngine.getCurrentContext(data.mode, data.language, data.modelId);
            const orchestrator = new LLMOrchestrator(data.provider, data.apiKey, data.baseUrl);
            const startTime = Date.now();
            const answer = await orchestrator.askQuestion(data.value, ctx, (msg) => {
                sidebarProvider.sendMessageToWebview('progress', msg);
            });
            const endTime = Date.now();
            const timeTaken = ((endTime - startTime) / 1000).toFixed(1);
            
            sidebarProvider.sendMessageToWebview('response', answer + `\n\n<div style="font-size: 10px; opacity: 0.5; margin-top: 8px; text-align: right;">⏱️ Generated in ${timeTaken}s</div>`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
            sidebarProvider.sendMessageToWebview('response', `**Error:** ${error.message}`);
        }
    });

    context.subscriptions.push(scanDisposable);
    context.subscriptions.push(askDisposable);
    context.subscriptions.push(webviewAskDisposable);
    context.subscriptions.push({ dispose: () => orchestrator.dispose() });
}
