import * as vscode from 'vscode';

export interface CodeContext {
    activeFile: string;
    fileContent: string;
    selection: string;
    diagnostics: string[];
    mode?: string;
    language?: string;
    modelId?: string;
    systemPrompt?: string;
}

export class ContextEngine {
    public static getCurrentContext(mode?: string, language?: string, modelId?: string): CodeContext {
        let systemPrompt = `You are CodeMind, an advanced autonomous AI engineering platform.
You are currently operating in Mode: "${mode}".
Target Language/Stack: "${language}".

CRITICAL DIRECTIVES:
1. ZERO-SHOT EXECUTION: You are an autonomous executor. DO NOT ask questions. DO NOT ask for clarification. DO NOT explain your thought process. Just write the code!
2. The user has selected the Target Language: "${language}". You MUST write the code in this language and use the universally standard filename/extension for it (e.g. .py, .cs, or Dockerfile). IGNORE the active file's language if it differs!
3. You MUST output the code using this EXACT custom syntax so our system can autonomously type it into the editor:
[FILE: relative/path/to/filename.ext]
YOUR CODE HERE
[/FILE]
4. PROJECT SCAFFOLDING: If the user asks for a full project, you are authorized to output MULTIPLE [FILE: path] blocks.
5. EXECUTION: To run the project automatically, you MUST output terminal commands using this syntax:
[COMMAND: npm install && npm run dev]
6. PREVIEW: If you start a web server, you MUST open it in the editor using this syntax:
[BROWSER: http://localhost:3000]
7. If you are in 'ask', 'debug', or 'plan' mode, just use standard markdown. But in 'code' mode, you are an autonomous executor.`;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                activeFile: 'No active file',
                fileContent: '',
                selection: '',
                diagnostics: [],
                mode: mode || 'code',
                language: language || 'auto',
                modelId: modelId || 'openai/gpt-oss-120b',
                systemPrompt
            };
        }

        const document = editor.document;
        const activeFile = document.fileName;
        
        // Truncate file content to prevent token overflow (approx first 500 lines)
        let fileContent = document.getText();
        const lines = fileContent.split('\n');
        if (lines.length > 500) {
            fileContent = lines.slice(0, 500).join('\n') + '\n...[Truncated]...';
        }

        const selection = document.getText(editor.selection);

        // Fetch Diagnostics (Problems)
        const diagnosticsArray = vscode.languages.getDiagnostics(document.uri);
        const diagnostics = diagnosticsArray.map(d => `Line ${d.range.start.line + 1}: ${d.message}`);

        return {
            activeFile,
            fileContent,
            selection,
            diagnostics,
            mode: mode || 'code',
            language: language && language.trim() !== '' && language.trim() !== 'auto' ? language : 'frontend react, typescript and python, javascript',
            modelId: modelId || 'openai/gpt-oss-120b'
        };
    }
}
