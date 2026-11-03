import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ToolExecutor {
    private static sharedTerminal: vscode.Terminal | undefined;
    public static sidebarProvider: any;
    private static pendingApprovals: Map<string, (approved: boolean) => void> = new Map();

    public static resolveApproval(commandId: string, approved: boolean) {
        if (this.pendingApprovals.has(commandId)) {
            this.pendingApprovals.get(commandId)!(approved);
            this.pendingApprovals.delete(commandId);
        }
    }

    // Defines the tools that the Groq model can call
    public static getToolsSchema() {
        return [
            {
                type: "function",
                function: {
                    name: "create_and_write_file",
                    description: "Creates a new file or overwrites an existing file with the provided content. Essential for scaffolding projects, writing code, or saving configurations.",
                    parameters: {
                        type: "object",
                        properties: {
                            filepath: {
                                type: "string",
                                description: "The relative path to the file (e.g. 'src/index.js' or 'package.json')"
                            },
                            content: {
                                type: "string",
                                description: "The complete string content to write to the file."
                            }
                        },
                        required: ["filepath", "content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "execute_terminal_command",
                    description: "Executes a shell command in the terminal. Essential for installing dependencies (npm install), running builds (npm run build), running tests, or initializing git repositories.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: {
                                type: "string",
                                description: "The terminal command to execute (e.g. 'npm install express' or 'mkdir -p src')"
                            }
                        },
                        required: ["command"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_web",
                    description: "Searches DuckDuckGo for the given query. Use this to find GitHub open-source code, syntax, and documentation.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The search query (e.g. 'site:github.com express js boilerplate')" }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "fetch_url_content",
                    description: "Fetches the raw text content of a URL. Useful for reading GitHub raw files or documentation pages.",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "The URL to fetch (e.g. 'https://raw.githubusercontent.com/...')" }
                        },
                        required: ["url"]
                    }
                }
            }
        ];
    }

    public static async executeTool(name: string, args: any): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            return "Error: No workspace open to execute tools in.";
        }
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            if (name === 'create_and_write_file') {
                const fullPath = path.join(workspacePath, args.filepath);
                const dir = path.dirname(fullPath);
                
                // Ensure directory exists
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // Create an empty file first if it doesn't exist
                if (!fs.existsSync(fullPath)) {
                    fs.writeFileSync(fullPath, '', 'utf8');
                }
                
                // Open file in VS Code editor
                const document = await vscode.workspace.openTextDocument(fullPath);
                const editor = await vscode.window.showTextDocument(document);

                // Clear existing content
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                await editor.edit(editBuilder => {
                    editBuilder.delete(fullRange);
                });

                // Simulate AI typing effect line by line
                const lines = args.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] + (i < lines.length - 1 ? '\n' : '');
                    await editor.edit(editBuilder => {
                        editBuilder.insert(new vscode.Position(i, 0), line);
                    });
                    
                    // Reveal the line so the editor scrolls with the typing
                    editor.revealRange(new vscode.Range(i, 0, i, 0));
                    
                    // Delay for organic typing feel
                    await new Promise(r => setTimeout(r, 15));
                }

                // Save the document after typing is complete
                await document.save();

                return `Successfully wrote to file: ${args.filepath}`;
            }
            else if (name === 'execute_terminal_command') {
                if (this.sidebarProvider) {
                    const commandId = Math.random().toString(36).substring(7);
                    
                    this.sidebarProvider.sendMessageToWebview('requestCommandApproval', {
                        commandId,
                        command: args.command
                    });
                    
                    const approved = await new Promise<boolean>((resolve) => {
                        this.pendingApprovals.set(commandId, resolve);
                    });
                    
                    if (!approved) {
                        return `User rejected command '${args.command}'.`;
                    }
                } else {
                    // Fallback to warning message if sidebar is closed
                    const selection = await vscode.window.showWarningMessage(
                        `CodeMind wants to execute: '${args.command}'`,
                        { modal: true },
                        "Approve", "Reject"
                    );
                    if (selection !== "Approve") {
                        return `User rejected command '${args.command}'.`;
                    }
                }

                if (!this.sharedTerminal || this.sharedTerminal.exitStatus !== undefined) {
                    this.sharedTerminal = vscode.window.createTerminal(`CodeMind`);
                }
                
                this.sharedTerminal.show();
                this.sharedTerminal.sendText(args.command);
                return `User approved command. Terminal 'CodeMind' is executing: '${args.command}'. Check terminal output for success/failure.`;
            }
            else if (name === 'open_browser') {
                await vscode.commands.executeCommand('simpleBrowser.show', args.url);
                return `Opened browser to ${args.url}`;
            }
            else if (name === 'search_web') {
                const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                const html = await res.text();
                const results: string[] = [];
                const snippetRegex = /<a class="result__url" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
                let match;
                while ((match = snippetRegex.exec(html)) !== null && results.length < 5) {
                    const url = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
                    const snippet = match[3].replace(/<\/?[^>]+(>|$)/g, "");
                    results.push(`URL: ${url}\nSnippet: ${snippet}`);
                }
                if (results.length === 0) return "No results found or search blocked.";
                return results.join('\n\n');
            }
            else if (name === 'fetch_url_content') {
                const res = await fetch(args.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
                let text = await res.text();
                // strip basic HTML tags if it's an HTML page (to save tokens), but don't strip if it's a raw code file
                if (text.includes('<html') && text.includes('</body>')) {
                    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                               .replace(/<\/?[^>]+(>|$)/g, " ")
                               .replace(/\s+/g, ' ');
                }
                if (text.length > 10000) text = text.substring(0, 10000) + '... (truncated to save tokens)';
                return text;
            }
            
            return `Error: Unknown tool ${name}`;
        } catch (e: any) {
            return `Error executing ${name}: ${e.message}`;
        }
    }
}
