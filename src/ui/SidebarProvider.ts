import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;

    constructor(private readonly _context: vscode.ExtensionContext) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'askQuestion': {
                    if (!data.value) {
                        return;
                    }
                    
                    // Save history
                    let history: any[] = this._context.workspaceState.get('chat_history') || [];
                    history.unshift({
                        text: data.value,
                        mode: data.mode || 'code',
                        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    if (history.length > 50) history.pop();
                    this._context.workspaceState.update('chat_history', history);
                    this.sendMessageToWebview('updateHistory', history);

                    // Pass the full data object which includes mode and language
                    vscode.commands.executeCommand('codemind.handleWebviewAsk', data);
                    break;
                }
                case 'clearHistory': {
                    this._context.workspaceState.update('chat_history', []);
                    this.sendMessageToWebview('updateHistory', []);
                    break;
                }
                case 'loadProfile': {
                    const profile = this._context.workspaceState.get('dev_profile');
                    this.sendMessageToWebview('profileLoaded', profile || null);
                    break;
                }
                case 'saveProfile': {
                    this._context.workspaceState.update('dev_profile', data.value);
                    this.sendMessageToWebview('profileLoaded', data.value);
                    break;
                }
                case 'logout': {
                    this._context.workspaceState.update('dev_profile', null);
                    this.sendMessageToWebview('profileLoaded', null);
                    break;
                }
                case 'saveModelState': {
                    this._context.workspaceState.update('active_model_state', data.activeState);
                    this._context.workspaceState.update('configured_models', data.configuredModels);
                    break;
                }
                case 'commandDecision': {
                    const { ToolExecutor } = require('../engine/reasoning/executor');
                    ToolExecutor.resolveApproval(data.commandId, data.approved);
                    break;
                }
                case 'fetchModels':
                case 'info': {
                    vscode.commands.executeCommand('codemind.handleWebviewAsk', data);
                    break;
                }
            }
        });

        // Send initial history to webview once it loads
        setTimeout(() => {
            const history = this._context.workspaceState.get('chat_history') || [];
            this.sendMessageToWebview('updateHistory', history);
        }, 500);
    }

    public sendMessageToWebview(type: string, value: any) {
        if (this._view) {
            this._view.webview.postMessage({ type, value });
        }
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        // Use VS Code's built-in codicons
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', 'logo.png'));
        
        const savedModels = this._context.workspaceState.get('configured_models') || [
            { provider: "Custom API", modelId: "qwen3-coder:30b", apiKey: "", baseUrl: "http://127.0.0.1:8000/v1", label: "qwen3-coder:30b (Custom API)" }
        ];
        this._context.workspaceState.update('configured_models', savedModels);

        const activeState: any = this._context.workspaceState.get('active_model_state') || {
            activeProvider: "Custom API",
            activeApiKey: "",
            activeBaseUrl: "http://127.0.0.1:8000/v1",
            activeModel: "qwen3-coder:30b"
        };
        this._context.workspaceState.update('active_model_state', activeState);
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: https: vscode-resource: vscode-webview-resource:; style-src 'unsafe-inline' https: vscode-resource: vscode-webview-resource:; font-src * data: https: vscode-resource: vscode-webview-resource:; script-src 'unsafe-inline' https: vscode-resource: vscode-webview-resource:;">
                <title>CodeMind Dashboard</title>
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
                <link href="${codiconsUri}" rel="stylesheet" />
                <!-- Include VS Code Codicons from a CDN for simplicity if local isn't bundled, or use standard symbols -->
                <link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet" />
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 0;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                    }
                    
                    /* Top Header */
                    .top-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 15px;
                        font-size: 13px;
                        font-weight: 600;
                    }
                    .header-icons {
                        display: flex;
                        gap: 12px;
                        opacity: 0.8;
                    }
                    .header-icons i { cursor: pointer; font-size: 15px; }
                    .header-icons i:hover { opacity: 1; color: var(--vscode-textLink-foreground); }

                    /* Empty State Center */
                    .empty-state {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 0 30px;
                        margin-top: -40px; /* Slight optical adjustment */
                    }
                    .main-logo {
                        width: 80px;
                        height: 80px;
                        object-fit: cover;
                        border-radius: 50%;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                        margin-bottom: 25px;
                        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        padding: 0;
                        border: 2px solid rgba(255, 255, 255, 0.2);
                    }
                    .main-logo:hover {
                        transform: scale(1.08) rotate(-2deg);
                    }
                    .empty-text {
                        font-size: 13px;
                        line-height: 1.5;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 25px;
                    }
                    .feedback-btn {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: transparent;
                        border: 1px dashed var(--vscode-textLink-foreground);
                        color: var(--vscode-textLink-foreground);
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .feedback-btn:hover {
                        background: rgba(0, 120, 212, 0.1);
                    }

                    /* Chat Area */
                    .chat-container {
                        flex-grow: 1;
                        overflow-y: auto;
                        display: none; /* Hidden until chat starts */
                        flex-direction: column;
                        padding: 15px 12px;
                        gap: 20px;
                    }
                    
                    /* Messages */
                    .message-row { display: flex; flex-direction: column; width: 100%; animation: fadeIn 0.3s ease; }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                    .msg-label { font-size: 0.75em; font-weight: bold; text-transform: uppercase; opacity: 0.6; margin-bottom: 4px; }
                    .message { line-height: 1.5; font-size: 0.95em; word-wrap: break-word; overflow-wrap: break-word; }
                    .user-msg-row { align-items: flex-end; }
                    .user-msg { background-color: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textLink-foreground); padding: 8px 12px; border-radius: 4px; max-width: 90%; white-space: pre-wrap; }
                    .ai-msg-row { align-items: flex-start; }
                    .ai-msg { width: 100%; color: var(--vscode-editor-foreground); }
                    
                    /* Code block styling */
                    pre {
                        white-space: pre-wrap !important;
                        word-wrap: break-word !important;
                        overflow-x: hidden !important;
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border, rgba(100,100,100,0.3));
                        border-top: 24px solid var(--vscode-editorGroupHeader-tabsBackground, rgba(50,50,50,0.8));
                        position: relative;
                        box-shadow: 0 6px 14px rgba(0,0,0,0.35);
                        margin: 16px 0;
                        padding: 14px;
                        border-radius: 8px;
                    }
                    pre::before {
                        content: 'Code Snippet';
                        position: absolute;
                        top: -20px;
                        left: 10px;
                        font-size: 10px;
                        color: var(--vscode-descriptionForeground);
                        font-family: var(--vscode-font-family);
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    code {
                        font-family: 'Consolas', 'Courier New', monospace;
                        font-size: 0.9em;
                    }
                    .hljs {
                        white-space: pre-wrap !important;
                        word-wrap: break-word !important;
                        word-break: break-all !important;
                        overflow-x: hidden !important;
                    }
                    
                    /* Input Area (Kilo style) */
                    .input-wrapper {
                        padding: 12px;
                        background: var(--vscode-editorWidget-background);
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .input-box {
                        display: flex;
                        flex-direction: column;
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-inputValidation-infoBorder);
                        border-radius: 8px;
                        padding: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        transition: border-color 0.2s;
                    }
                    .input-box:focus-within { border-color: var(--vscode-focusBorder); }
                    
                    /* Pill Row (Tags above textarea) */
                    .pill-row {
                        display: flex;
                        gap: 6px;
                        margin-bottom: 8px;
                        flex-wrap: wrap;
                        align-items: center;
                    }

                    /* Sleek Pills for Selects and Inputs */
                    .pill-select, .lang-search {
                        appearance: none;
                        background-color: var(--vscode-button-secondaryBackground, rgba(130, 130, 130, 0.15));
                        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
                        border: 1px solid transparent;
                        border-radius: 16px;
                        padding: 4px 10px;
                        font-size: 11px;
                        font-weight: 600;
                        outline: none;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .pill-select {
                        padding-right: 24px;
                        /* SVG Chevron */
                        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23aaaaaa%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E");
                        background-repeat: no-repeat;
                        background-position: right 6px center;
                        background-size: 12px;
                    }

                    .lang-search {
                        cursor: text;
                        width: 140px;
                    }
                    .lang-search::placeholder {
                        color: var(--vscode-descriptionForeground);
                        opacity: 0.8;
                    }

                    .pill-select:hover, .lang-search:hover, .lang-search:focus {
                        background-color: var(--vscode-button-secondaryHoverBackground, rgba(130, 130, 130, 0.25));
                        border-color: var(--vscode-focusBorder);
                    }

                    /* Custom Dropdown Styles (Forced Upwards) */
                    .dropdown-container {
                        position: relative;
                        display: inline-block;
                    }
                    .dropdown-menu {
                        display: none;
                        position: absolute;
                        bottom: calc(100% + 8px); /* FORCE UPWARDS */
                        left: 0;
                        background: rgba(30, 30, 30, 0.85);
                        backdrop-filter: blur(12px) saturate(180%);
                        -webkit-backdrop-filter: blur(12px) saturate(180%);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        box-shadow: 0 16px 40px rgba(0,0,0,0.5);
                        min-width: 140px;
                        max-height: 220px;
                        overflow-y: auto;
                        z-index: 1000;
                        transform-origin: bottom left;
                        animation: popUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @keyframes popUp {
                        0% { opacity: 0; transform: translateY(10px) scale(0.95); }
                        100% { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .dropdown-menu.show {
                        display: block;
                    }
                    .dropdown-item {
                        padding: 8px 14px;
                        cursor: pointer;
                        font-size: 11px;
                        color: var(--vscode-dropdown-foreground);
                        border-radius: 6px;
                        margin: 2px 4px;
                        transition: all 0.2s ease;
                    }
                    .dropdown-item:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: var(--vscode-textLink-foreground);
                    }
                    .lang-search::-webkit-calendar-picker-indicator {
                        display: none !important;
                    }

                    /* Overlay Panels (Settings / History / Hub) */
                    .overlay-panel {
                        position: fixed;
                        top: 0; right: -100%; bottom: 0; width: 85%;
                        background: rgba(30, 30, 30, 0.85);
                        backdrop-filter: blur(16px) saturate(180%);
                        -webkit-backdrop-filter: blur(16px) saturate(180%);
                        border-left: 1px solid rgba(255, 255, 255, 0.1);
                        box-shadow: -8px 0 32px rgba(0,0,0,0.5);
                        z-index: 2000;
                        transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                        display: flex;
                        flex-direction: column;
                    }
                    .overlay-panel.open {
                        right: 0;
                    }
                    .overlay-header {
                        padding: 16px 20px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-weight: 600;
                        font-size: 13px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.05), transparent);
                    }
                    .close-overlay { cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
                    .close-overlay:hover { opacity: 1; }
                    .overlay-content { padding: 16px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 16px; }
                    
                    /* Settings Forms */
                    .setting-group { display: flex; flex-direction: column; gap: 6px; }
                    .setting-group label { font-size: 11px; opacity: 0.8; font-weight: 600; }
                    .setting-input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-inputValidation-infoBorder); padding: 8px; border-radius: 4px; font-size: 12px; outline: none; }
                    .setting-input:focus { border-color: var(--vscode-focusBorder); }
                    .primary-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
                    .primary-btn:hover { background: var(--vscode-button-hoverBackground); transform: translateY(-1px); }

                    /* History Items */
                    .history-item { padding: 12px 14px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-size: 12px; border: 1px solid transparent; transition: all 0.2s; }
                    .history-item:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255,255,255,0.1); transform: translateY(-1px); }
                    .history-date { font-size: 10px; opacity: 0.6; margin-top: 6px; }

                    /* Model Hub Specifics */
                    .provider-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    .provider-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .provider-card:hover { background: rgba(255, 255, 255, 0.08); border-color: var(--vscode-focusBorder); transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
                    .provider-logo { width: 32px; height: 32px; margin-bottom: 12px; object-fit: contain; background: white; border-radius: 50%; padding: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
                    .provider-name { font-size: 11px; font-weight: 700; text-align: center; }
                    .config-view { display: none; flex-direction: column; gap: 16px; }
                    .config-view.active { display: flex; }
                    .hub-view { display: flex; flex-direction: column; gap: 16px; }
                    .hub-view.hidden { display: none; }
                    .back-btn { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-size: 11px; opacity: 0.8; margin-bottom: 12px; font-weight: 600; }
                    .back-btn:hover { opacity: 1; color: var(--vscode-textLink-foreground); }
                    
                    textarea {
                        flex-grow: 1; background: transparent; color: var(--vscode-input-foreground); border: none; padding: 4px 0 10px 0; font-family: var(--vscode-font-family); font-size: 0.95em; resize: none; outline: none; min-height: 24px; max-height: 150px; overflow-y: auto;
                    }
                    textarea::placeholder { opacity: 0.5; }
                    
                    /* Toolbar */
                    .input-toolbar {
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                        padding-top: 8px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .toolbar-right { display: flex; gap: 12px; align-items: center; color: var(--vscode-icon-foreground); opacity: 0.7; }
                    .toolbar-right i { cursor: pointer; font-size: 16px; padding: 4px; border-radius: 4px; transition: all 0.2s; }
                    .toolbar-right i:hover { opacity: 1; color: var(--vscode-textLink-foreground); background: var(--vscode-toolbar-hoverBackground); }
                    .send-icon { color: var(--vscode-textLink-foreground) !important; font-size: 16px !important; opacity: 1 !important; }

                    /* Account Settings & Profile */
                    .auth-view { display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; height: 100%; padding: 20px; }
                    .auth-view h2 { margin: 0 0 10px 0; font-size: 16px; }
                    .profile-dashboard { display: none; flex-direction: column; gap: 20px; padding: 15px; height: 100%; overflow-y: auto; }
                    .profile-header { display: flex; align-items: center; gap: 15px; }
                    .profile-avatar { width: 48px; height: 48px; background: var(--vscode-focusBorder); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; font-weight: bold; }
                    .profile-info h3 { margin: 0 0 4px 0; font-size: 14px; }
                    .profile-info p { margin: 0; font-size: 11px; opacity: 0.7; }
                    
                    /* GitHub-style Activity Graph */
                    .activity-section, .memory-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; }
                    .section-title { font-size: 11px; font-weight: 700; opacity: 0.8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .activity-graph { display: grid; grid-template-columns: repeat(30, 1fr); gap: 2px; }
                    .graph-day { width: 100%; aspect-ratio: 1; background: rgba(255,255,255,0.05); border-radius: 2px; }
                    .graph-day[data-level="1"] { background: #0e4429; }
                    .graph-day[data-level="2"] { background: #006d32; }
                    .graph-day[data-level="3"] { background: #26a641; }
                    .graph-day[data-level="4"] { background: #39d353; }
                    
                    /* Memory Chips */
                    .memory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .memory-card { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
                    .memory-card h4 { margin: 0 0 6px 0; font-size: 11px; opacity: 0.7; }
                    .memory-tags { display: flex; flex-wrap: wrap; gap: 6px; }
                    .memory-tag { padding: 3px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 12px; font-size: 10px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="top-header">
                    <div>CodeMind</div>
                    <div class="header-icons">
                        <i class="codicon codicon-add" id="btnNewChat" title="New Chat"></i>
                        <i class="codicon codicon-history" id="btnHistory" title="History"></i>
                        <i class="codicon codicon-organization" id="btnOrg" title="Workspace"></i>
                        <i class="codicon codicon-layout-panel" id="btnLayout" title="Layout"></i>
                        <i class="codicon codicon-account" id="btnAccount" title="Account"></i>
                        <i class="codicon codicon-settings-gear" id="btnSettings" title="Settings"></i>
                    </div>
                </div>
                
                <div id="emptyState" class="empty-state">
                    <svg class="main-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                        <defs>
                            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#d6f8fc"/>
                                <stop offset="50%" stop-color="#e6e1fb"/>
                                <stop offset="100%" stop-color="#c9ccf5"/>
                            </linearGradient>
                            <style>
                                .eye {
                                    transform-origin: center;
                                    transform-box: fill-box;
                                    animation: blink 4s infinite;
                                }
                                @keyframes blink {
                                    0%, 92%, 100% { transform: scaleY(1); }
                                    96% { transform: scaleY(0); }
                                }
                            </style>
                        </defs>
                        <rect width="100" height="100" fill="url(#bg)"/>
                        <!-- Right Ear -->
                        <polygon points="60,35 75,20 80,45" fill="#000"/>
                        <!-- Left Ear with gap -->
                        <polygon points="15,45 35,35 25,60" fill="#000"/>
                        <!-- Head -->
                        <circle cx="50" cy="55" r="28" fill="#000" stroke="url(#bg)" stroke-width="2"/>
                        <!-- Left Eye -->
                        <g class="eye">
                            <!-- Sclera -->
                            <circle cx="38" cy="58" r="9" fill="#fff"/>
                            <!-- Pupil that moves -->
                            <g id="pupil-left" style="transition: transform 0.1s ease-out">
                                <circle cx="38" cy="58" r="5" fill="#000"/>
                                <!-- Sparkle -->
                                <circle cx="36" cy="56" r="1.5" fill="#fff"/>
                            </g>
                        </g>
                        <!-- Right Eye -->
                        <g class="eye">
                            <!-- Sclera -->
                            <circle cx="62" cy="58" r="9" fill="#fff"/>
                            <!-- Pupil that moves -->
                            <g id="pupil-right" style="transition: transform 0.1s ease-out">
                                <circle cx="62" cy="58" r="5" fill="#000"/>
                                <!-- Sparkle -->
                                <circle cx="60" cy="56" r="1.5" fill="#fff"/>
                            </g>
                        </g>
                    </svg>
                    <div class="empty-text">
                        I'm <b>CodeMind</b>, your AI engineering assistant. Ask me anything or select a stack below to start scaffolding!
                    </div>
                    <button class="feedback-btn">
                        <i class="codicon codicon-comment-discussion"></i> Feedback & Support
                    </button>
                </div>

                <!-- Overlays -->
                <div id="modelHubOverlay" class="overlay-panel">
                    <div class="overlay-header">
                        <span>Universal Model Hub</span>
                        <i class="codicon codicon-close close-overlay" id="closeModelHub"></i>
                    </div>
                    <div class="overlay-content">
                        <!-- Provider Grid View -->
                        <div id="hubGridView" class="hub-view">
                            <div class="provider-grid">
                                <div class="provider-card" data-provider="OpenAI">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg" class="provider-logo" alt="OpenAI" style="background:transparent; padding:0; box-shadow:none;">
                                    <div class="provider-name">OpenAI</div>
                                </div>
                                <div class="provider-card" data-provider="Anthropic">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg" class="provider-logo" alt="Anthropic" style="background:#f4ece6;">
                                    <div class="provider-name">Anthropic (Claude)</div>
                                </div>
                                <div class="provider-card" data-provider="Gemini">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" class="provider-logo" alt="Gemini">
                                    <div class="provider-name">Google Gemini</div>
                                </div>
                                <div class="provider-card" data-provider="Groq">
                                    <img src="https://groq.com/wp-content/uploads/2024/02/Groq-logo-black.svg" class="provider-logo" alt="Groq" style="background:transparent; box-shadow:none; filter: invert(1);">
                                    <div class="provider-name">Groq LPU</div>
                                </div>
                                <div class="provider-card" data-provider="Ollama">
                                    <img src="https://ollama.com/public/icon-64x64.png" class="provider-logo" alt="Ollama" style="background:transparent; box-shadow:none;">
                                    <div class="provider-name">Ollama (Local)</div>
                                </div>
                                <div class="provider-card" data-provider="HuggingFace">
                                    <img src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg" class="provider-logo" alt="Hugging Face">
                                    <div class="provider-name">Hugging Face</div>
                                </div>
                                <div class="provider-card" data-provider="xAI">
                                    <div class="provider-logo" style="display:flex; align-items:center; justify-content:center; background:black; color:white; font-size:20px; font-weight:900;">X</div>
                                    <div class="provider-name">xAI (Grok)</div>
                                </div>
                                <div class="provider-card" data-provider="Custom API">
                                    <div class="provider-logo" style="display:flex; align-items:center; justify-content:center; background:#4CAF50; color:white; font-size:16px; font-weight:900;"><i class="codicon codicon-server-environment"></i></div>
                                    <div class="provider-name">Custom API</div>
                                </div>
                            </div>
                        </div>

                        <!-- Single Provider Config View -->
                        <div id="hubConfigView" class="config-view">
                            <div class="back-btn" id="hubBackBtn"><i class="codicon codicon-chevron-left"></i> Back to Providers</div>
                            <h3 style="margin:0; padding:0; display:flex; align-items:center; gap:8px;">
                                <img id="configProviderLogo" src="" style="width:24px; height:24px; object-fit:contain; background:white; border-radius:50%;">
                                <span id="configProviderName">Provider</span>
                            </h3>
                            
                            <div class="setting-group" id="apiKeyGroup">
                                <label>API Key</label>
                                <input type="password" id="providerApiKey" class="setting-input" placeholder="Enter API Key (sk-...)">
                            </div>
                            
                            <div class="setting-group" id="baseUrlGroup" style="display:none;">
                                <label>Local Base URL</label>
                                <input type="text" id="providerBaseUrl" class="setting-input" value="http://localhost:11434">
                            </div>
                            
                            <button class="primary-btn" id="fetchModelsBtn" style="background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground);">
                                <i class="codicon codicon-sync"></i> Fetch Available Models
                            </button>
                            
                            <div class="setting-group">
                                <label>Select Model</label>
                                <select id="providerModelSelect" class="setting-input">
                                    <option value="">Fetch models to select...</option>
                                </select>
                            </div>

                            <button class="primary-btn" id="saveProviderBtn">Set as Active Provider</button>
                        </div>
                    </div>
                </div>

                <div id="settingsOverlay" class="overlay-panel">
                    <div class="overlay-header">
                        <span>Settings</span>
                        <i class="codicon codicon-close close-overlay" id="closeSettings"></i>
                    </div>
                    <div class="overlay-content">
                        <div class="setting-group">
                            <label>API Key</label>
                            <input type="password" class="setting-input" value="" placeholder="Enter API Key">
                        </div>
                        <div class="setting-group">
                            <label>System Prompt Customization</label>
                            <textarea class="setting-input" rows="4" placeholder="You are an expert AI..."></textarea>
                        </div>
                        <button class="primary-btn" id="saveSettingsBtn">Save Changes</button>
                    </div>
                </div>

                <div id="historyOverlay" class="overlay-panel">
                    <div class="overlay-header">
                        <span>Chat History</span>
                        <div>
                            <i class="codicon codicon-trash" id="clearHistoryBtn" title="Clear History" style="cursor: pointer; opacity: 0.7; margin-right: 12px;"></i>
                            <i class="codicon codicon-close close-overlay" id="closeHistory"></i>
                        </div>
                    </div>
                    <div class="overlay-content" id="historyContent">
                        <div style="padding: 12px; opacity: 0.6; font-size: 11px; text-align: center;">Loading history...</div>
                    </div>
                </div>

                <div id="accountOverlay" class="overlay-panel">
                    <div class="overlay-header">
                        <span id="accountOverlayTitle">Account & Memory Dashboard</span>
                        <div>
                            <i class="codicon codicon-sign-out" id="logoutBtn" title="Logout" style="display:none; cursor: pointer; opacity: 0.7; margin-right: 12px;"></i>
                            <i class="codicon codicon-close close-overlay" id="closeAccount"></i>
                        </div>
                    </div>
                    
                    <div class="overlay-content" style="padding:0;">
                        <!-- Auth View -->
                        <div id="authView" class="auth-view">
                            <i class="codicon codicon-account" style="font-size: 48px; opacity: 0.5; margin-bottom: 10px;"></i>
                            <h2>Create Profile</h2>
                            <p style="font-size: 11px; opacity: 0.7; text-align: center; margin-top: 0;">Set up your developer persona so CodeMind can learn your style.</p>
                            
                            <div class="setting-group" style="width: 100%; max-width: 250px;">
                                <label>Username</label>
                                <input type="text" id="authUsername" class="setting-input" placeholder="e.g. Neo">
                            </div>
                            <div class="setting-group" style="width: 100%; max-width: 250px; margin-top: 8px;">
                                <label>Password</label>
                                <input type="password" id="authPassword" class="setting-input" placeholder="••••••••">
                            </div>
                            <div class="setting-group" style="width: 100%; max-width: 250px; margin-top: 8px;">
                                <label>Confirm Password</label>
                                <input type="password" id="authConfirm" class="setting-input" placeholder="••••••••">
                            </div>
                            <p id="authError" style="color: var(--vscode-errorForeground); font-size: 11px; display: none; margin: 4px 0 0 0;"></p>
                            
                            <button class="primary-btn" id="btnSignup" style="width: 100%; max-width: 250px; margin-top: 15px;">Create Profile</button>
                        </div>

                        <!-- Profile Dashboard -->
                        <div id="profileDashboard" class="profile-dashboard">
                            <div class="profile-header">
                                <div class="profile-avatar" id="profileInitial">A</div>
                                <div class="profile-info">
                                    <h3 id="profileName">Developer</h3>
                                    <p>CodeMind Developer Profile</p>
                                </div>
                            </div>

                            <div class="activity-section">
                                <div class="section-title">Activity (Recent)</div>
                                <div class="activity-graph" id="activityGraph">
                                    <!-- Graph generated via JS -->
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 9px; opacity: 0.6;">
                                    <span>Less</span>
                                    <div style="display: flex; gap: 2px;">
                                        <div class="graph-day" style="width: 8px; height: 8px;"></div>
                                        <div class="graph-day" data-level="1" style="width: 8px; height: 8px;"></div>
                                        <div class="graph-day" data-level="2" style="width: 8px; height: 8px;"></div>
                                        <div class="graph-day" data-level="3" style="width: 8px; height: 8px;"></div>
                                        <div class="graph-day" data-level="4" style="width: 8px; height: 8px;"></div>
                                    </div>
                                    <span>More</span>
                                </div>
                            </div>

                            <div class="memory-section">
                                <div class="section-title">Developer Memory Engine</div>
                                <div class="memory-grid">
                                    <div class="memory-card">
                                        <h4>Active Projects</h4>
                                        <div class="memory-tags" id="memProjects">
                                            <span class="memory-tag">Isuzu Frontend</span>
                                            <span class="memory-tag">Finance SAP</span>
                                        </div>
                                    </div>
                                    <div class="memory-card">
                                        <h4>Preferred Stack</h4>
                                        <div class="memory-tags" id="memStack">
                                            <span class="memory-tag">React</span>
                                            <span class="memory-tag">C#</span>
                                            <span class="memory-tag">JavaScript</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="memory-card" style="margin-top: 10px;">
                                    <h4>Prompt Style Memory</h4>
                                    <p style="font-size: 10px; opacity: 0.8; margin: 0; line-height: 1.4;" id="memPrompt">Prefers zero-shot execution without explanations. Enjoys aesthetic, premium UI designs with dynamic animations and modern color palettes. Emphasizes clean modular code.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="chat-container" id="chat">
                    <!-- Chat messages will be injected here -->
                </div>

                <div class="input-wrapper">
                    <div class="input-box">
                        <div class="pill-row">
                            <!-- Custom Upward Mode Dropdown -->
                            <div class="dropdown-container" id="modeContainer">
                                <button id="modeBtn" class="pill-select">Code</button>
                                <div id="modeMenu" class="dropdown-menu">
                                    <div class="dropdown-item" data-value="code">Code</div>
                                    <div class="dropdown-item" data-value="ask">Ask</div>
                                    <div class="dropdown-item" data-value="debug">Debug</div>
                                    <div class="dropdown-item" data-value="plan">Plan</div>
                                </div>
                                <input type="hidden" id="modeValue" value="code">
                            </div>
                            
                            <!-- Custom Upward Language Search -->
                            <div class="dropdown-container" id="langContainer">
                                <input type="text" id="langInput" class="lang-search" placeholder="Lang (e.g. Python)" autocomplete="off" />
                                <div id="langMenu" class="dropdown-menu"></div>
                            </div>
                            
                            <!-- Custom Upward Model Dropdown -->
                            <div class="dropdown-container" id="modelContainer">
                                <button id="modelBtn" class="pill-select" style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">GPT-OSS 120B</button>
                                <i class="codicon codicon-circuit-board" id="btnModelHub" title="Configure Model Providers" style="cursor: pointer; margin-left: 6px; font-size: 15px; opacity: 0.8; vertical-align: middle;"></i>
                                <div id="modelMenu" class="dropdown-menu">
                                    <!-- Populated dynamically -->
                                </div>
                                <input type="hidden" id="modelValue" value="openai/gpt-oss-120b">
                            </div>
                        </div>

                        <textarea id="prompt" rows="2" placeholder="Type a message, @ to mention files..."></textarea>
                        
                        <div class="input-toolbar">
                            <div class="toolbar-right">
                                <i class="codicon codicon-database" title="Context"></i>
                                <i class="codicon codicon-shield" title="Permissions"></i>
                                <i class="codicon codicon-wand" title="Magic"></i>
                                <i class="codicon codicon-mic" title="Voice Input"></i>
                                <i class="codicon codicon-send send-icon" id="sendBtn" title="Send"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const chat = document.getElementById('chat');
                    const emptyState = document.getElementById('emptyState');
                    const input = document.getElementById('prompt');
                    const sendBtn = document.getElementById('sendBtn');
                    
                    // --- STATE RESTORATION ---
                    const oldState = vscode.getState() || {};
                    if (oldState.chatHtml) {
                        chat.innerHTML = oldState.chatHtml;
                        if (oldState.chatHtml.trim() !== '') {
                            emptyState.style.display = 'none';
                            chat.style.display = 'flex';
                            chat.scrollTop = chat.scrollHeight;
                        }
                    }
                    if (oldState.inputValue) {
                        input.value = oldState.inputValue;
                        setTimeout(() => {
                            input.style.height = 'auto';
                            input.style.height = (input.scrollHeight) + 'px';
                        }, 0);
                    }

                    function saveState() {
                        vscode.setState({
                            chatHtml: chat.innerHTML,
                            inputValue: input.value
                        });
                    }
                    
                    // --- CUSTOM DROPDOWN LOGIC ---
                    const modeBtn = document.getElementById('modeBtn');
                    // Active State
                    let activeProvider = "${activeState.activeProvider}";
                    let activeApiKey = "${activeState.activeApiKey}";
                    let activeBaseUrl = "${activeState.activeBaseUrl}";
                    let activeModel = "${activeState.activeModel}";
                    
                    const modeMenu = document.getElementById('modeMenu');
                    const modeValue = document.getElementById('modeValue');
                    
                    const modelBtn = document.getElementById('modelBtn');
                    const modelMenu = document.getElementById('modelMenu');
                    const modelValue = document.getElementById('modelValue');
                    
                    modelBtn.textContent = activeModel;
                    
                    let configuredModels = ${JSON.stringify(savedModels)};
                    
                    function saveModelState() {
                        vscode.postMessage({
                            type: 'saveModelState',
                            activeState: { activeProvider, activeApiKey, activeBaseUrl, activeModel },
                            configuredModels
                        });
                    }

                    function renderModelMenu() {
                        modelMenu.innerHTML = '';
                        configuredModels.forEach((conf, index) => {
                            const div = document.createElement('div');
                            div.className = 'dropdown-item';
                            div.textContent = conf.label;
                            div.dataset.index = index;
                            modelMenu.appendChild(div);
                        });
                    }
                    renderModelMenu();
                    
                    const langInput = document.getElementById('langInput');
                    const langMenu = document.getElementById('langMenu');

                    function closeAllMenus() {
                        modeMenu.classList.remove('show');
                        modelMenu.classList.remove('show');
                        langMenu.classList.remove('show');
                    }
                    document.addEventListener('click', closeAllMenus);

                    // Mode Dropdown
                    modeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeAllMenus();
                        modeMenu.classList.toggle('show');
                    });
                    modeMenu.addEventListener('click', (e) => {
                        if (e.target.classList.contains('dropdown-item')) {
                            modeBtn.textContent = e.target.textContent;
                            modeValue.value = e.target.dataset.value;
                            modeMenu.classList.remove('show');
                        }
                    });

                    // Model Dropdown
                    modelBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeAllMenus();
                        modelMenu.classList.toggle('show');
                    });
                    modelMenu.addEventListener('click', (e) => {
                        if (e.target.classList.contains('dropdown-item')) {
                            const conf = configuredModels[e.target.dataset.index];
                            activeProvider = conf.provider;
                            activeApiKey = conf.apiKey;
                            activeBaseUrl = conf.baseUrl;
                            activeModel = conf.modelId;
                            
                            modelBtn.textContent = conf.modelId;
                            modelMenu.classList.remove('show');
                            saveModelState();
                        }
                    });

                    // Language Dropdown
                    const languages = [
                        "HTML/CSS Combined", "HTML", "CSS", "JavaScript", "TypeScript", "React", "Angular", "Vue", "Svelte", "SCSS / Sass", "Less", 
                        "Node.js", "Python", "Java", "C#", "Go", "PHP", "Ruby", "Kotlin", "Rust", "C++", "C", "Scala", "Elixir", "Dart", "Swift", "Perl", "Lua", "Erlang", "Haskell", "R",
                        "SQL", "PostgreSQL", "MySQL", "Oracle (PL/SQL)", "T-SQL", "SQLite", "MongoDB (MQL)", "Redis", "Cassandra (CQL)", "GraphQL", "Cypher / Neo4j", "Gremlin", "Elasticsearch", "DynamoDB", "Firestore",
                        "Flutter", "React Native", "Objective-C", "Electron", "MAUI", "Qt", 
                        "Bash / Shell", "PowerShell", "Terraform (HCL)", "YAML", "JSON", "Dockerfile", "Groovy",
                        "Assembly", "Zig", "Ada", "VHDL / Verilog", "Solidity", "Move", "Vyper", "Cairo", "COBOL", "Fortran", "MATLAB", "Julia", "ABAP", "Apex", "LaTeX"
                    ];

                    function renderLangMenu(filter = "") {
                        langMenu.innerHTML = "";
                        const filtered = languages.filter(l => l.toLowerCase().includes(filter.toLowerCase()));
                        filtered.forEach(l => {
                            const div = document.createElement('div');
                            div.className = 'dropdown-item';
                            div.textContent = l;
                            div.addEventListener('click', (e) => {
                                e.stopPropagation();
                                langInput.value = l;
                                langMenu.classList.remove('show');
                            });
                            langMenu.appendChild(div);
                        });
                    }

                    langInput.addEventListener('focus', () => {
                        closeAllMenus();
                        renderLangMenu(langInput.value);
                        langMenu.classList.add('show');
                    });
                    langInput.addEventListener('input', () => {
                        renderLangMenu(langInput.value);
                        langMenu.classList.add('show');
                    });
                    langInput.addEventListener('click', (e) => { e.stopPropagation(); });
                    langMenu.addEventListener('click', (e) => { e.stopPropagation(); });
                    // -----------------------------

                    input.addEventListener('input', function() {
                        this.style.height = 'auto';
                        this.style.height = (this.scrollHeight) + 'px';
                        saveState();
                    });

                    function addMessage(text, isUser, isHtml = false) {
                        emptyState.style.display = 'none';
                        chat.style.display = 'flex';
                        
                        const row = document.createElement('div');
                        row.className = 'message-row ' + (isUser ? 'user-msg-row' : 'ai-msg-row');
                        
                        const label = document.createElement('div');
                        label.className = 'msg-label';
                        label.textContent = isUser ? 'You' : 'CodeMind (' + modeValue.value + ')';
                        
                        const msg = document.createElement('div');
                        msg.className = 'message ' + (isUser ? 'user-msg' : 'ai-msg');
                        
                        if (isHtml) { msg.innerHTML = text; } 
                        else { msg.textContent = text; }
                        
                        row.appendChild(label);
                        row.appendChild(msg);
                        chat.appendChild(row);
                        chat.scrollTop = chat.scrollHeight;
                        saveState();
                    }

                    function sendMessage() {
                        const text = input.value.trim();
                        if (text) {
                            addMessage(text, true, false);
                            vscode.postMessage({ 
                                type: 'askQuestion', 
                                value: text,
                                mode: modeValue.value,
                                language: langInput.value || 'auto',
                                modelId: activeModel,
                                provider: activeProvider,
                                apiKey: activeApiKey,
                                baseUrl: activeBaseUrl
                            });
                            input.value = '';
                            input.style.height = 'auto';
                            saveState();
                        }
                    }

                    sendBtn.addEventListener('click', sendMessage);

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'response':
                                const loadingMsgs = document.querySelectorAll('.loading-msg');
                                loadingMsgs.forEach(el => el.remove());
                                
                                let parsedHtml = message.value;
                                if (typeof marked !== 'undefined') {
                                    parsedHtml = marked.parse(message.value);
                                }
                                addMessage(parsedHtml, false, true);
                                if (typeof hljs !== 'undefined') {
                                    setTimeout(() => hljs.highlightAll(), 10);
                                }
                                saveState();
                                break;
                            case 'requestCommandApproval': {
                                emptyState.style.display = 'none';
                                chat.style.display = 'flex';
                                
                                const row = document.createElement('div');
                                row.className = 'message-row ai-msg-row';
                                
                                const label = document.createElement('div');
                                label.className = 'msg-label';
                                label.textContent = 'Terminal Action Required';
                                
                                const msg = document.createElement('div');
                                msg.className = 'message ai-msg';
                                msg.style.border = '1px solid var(--vscode-editorWarning-foreground)';
                                msg.style.background = 'var(--vscode-editor-background)';
                                
                                msg.innerHTML = \`
                                    <div style="margin-bottom: 8px;">CodeMind wants to execute a command:</div>
                                    <pre style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 11px;">\${message.value.command}</pre>
                                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                                        <button class="approve-btn" style="flex: 1; padding: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 4px;">Approve</button>
                                        <button class="reject-btn" style="flex: 1; padding: 6px; background: transparent; color: var(--vscode-button-background); border: 1px solid var(--vscode-button-background); cursor: pointer; border-radius: 4px;">Reject</button>
                                    </div>
                                \`;
                                
                                const approveBtn = msg.querySelector('.approve-btn');
                                const rejectBtn = msg.querySelector('.reject-btn');
                                
                                const handleDecision = (approved) => {
                                    approveBtn.disabled = true;
                                    rejectBtn.disabled = true;
                                    msg.style.opacity = '0.5';
                                    vscode.postMessage({ type: 'commandDecision', commandId: message.value.commandId, approved });
                                };
                                
                                approveBtn.addEventListener('click', () => handleDecision(true));
                                rejectBtn.addEventListener('click', () => handleDecision(false));
                                
                                row.appendChild(label);
                                row.appendChild(msg);
                                chat.appendChild(row);
                                chat.scrollTop = chat.scrollHeight;
                                break;
                            }
                            case 'modelsFetched':
                                const select = document.getElementById('providerModelSelect');
                                select.innerHTML = '';
                                if (message.value && message.value.models && message.value.models.length > 0) {
                                    message.value.models.forEach(m => {
                                        const opt = document.createElement('option');
                                        opt.value = m.id;
                                        opt.textContent = m.name || m.id;
                                        select.appendChild(opt);
                                    });
                                } else {
                                    select.innerHTML = '<option value="">No models found or error</option>';
                                }
                                break;
                            case 'progress': {
                                const loadingMsg = document.querySelector('.loading-msg .message');
                                if (loadingMsg) {
                                    loadingMsg.innerHTML = '<span style="font-style: italic;">Thinking...</span><br><span style="font-size: 10px; opacity: 0.8; color: var(--vscode-textLink-foreground);">↳ ' + message.value + '</span>';
                                }
                                chat.scrollTop = chat.scrollHeight;
                                break;
                            }
                            case 'loading':
                                emptyState.style.display = 'none';
                                chat.style.display = 'flex';
                                const row = document.createElement('div');
                                row.className = 'message-row ai-msg-row loading-msg';
                                row.innerHTML = '<div class="msg-label">CodeMind</div><div class="message ai-msg" style="opacity: 0.6;"><span style="font-style: italic;">Thinking...</span></div>';
                                chat.appendChild(row);
                                chat.scrollTop = chat.scrollHeight;
                                saveState();
                                break;
                            case 'updateHistory':
                                const historyContent = document.getElementById('historyContent');
                                historyContent.innerHTML = '';
                                if (!message.value || message.value.length === 0) {
                                    historyContent.innerHTML = '<div style="padding: 12px; opacity: 0.6; font-size: 11px; text-align: center;">No chat history yet.</div>';
                                } else {
                                    message.value.forEach(item => {
                                        const div = document.createElement('div');
                                        div.className = 'history-item';
                                        
                                        // Escape HTML to prevent XSS
                                        const escapeHtml = (unsafe) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                                        
                                        div.innerHTML = \`
                                            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${escapeHtml(item.text)}</div>
                                            <div class="history-date" style="display: flex; justify-content: space-between;">
                                                <span>\${item.mode.toUpperCase()}</span>
                                                <span>\${item.date}</span>
                                            </div>
                                        \`;
                                        div.addEventListener('click', () => {
                                            document.getElementById('prompt').value = item.text;
                                            document.getElementById('historyOverlay').classList.remove('open');
                                            document.getElementById('prompt').focus();
                                        });
                                        historyContent.appendChild(div);
                                    });
                                }
                                break;
                            case 'profileLoaded':
                                const pView = document.getElementById('profileDashboard');
                                const aView = document.getElementById('authView');
                                const lBtn = document.getElementById('logoutBtn');
                                
                                if (message.value) {
                                    aView.style.display = 'none';
                                    pView.style.display = 'flex';
                                    lBtn.style.display = 'block';
                                    
                                    document.getElementById('profileName').textContent = message.value.username;
                                    document.getElementById('profileInitial').textContent = message.value.username.charAt(0).toUpperCase();
                                    
                                    // Generate Graph
                                    const graph = document.getElementById('activityGraph');
                                    graph.innerHTML = '';
                                    // Make 7 rows of 30 columns
                                    for (let i = 0; i < 30 * 7; i++) {
                                        const day = document.createElement('div');
                                        day.className = 'graph-day';
                                        if (i > 150) {
                                            const rand = Math.random();
                                            if (rand > 0.9) day.setAttribute('data-level', '4');
                                            else if (rand > 0.75) day.setAttribute('data-level', '3');
                                            else if (rand > 0.6) day.setAttribute('data-level', '2');
                                            else if (rand > 0.4) day.setAttribute('data-level', '1');
                                        }
                                        graph.appendChild(day);
                                    }
                                } else {
                                    aView.style.display = 'flex';
                                    pView.style.display = 'none';
                                    lBtn.style.display = 'none';
                                    document.getElementById('authUsername').value = '';
                                    document.getElementById('authPassword').value = '';
                                    document.getElementById('authConfirm').value = '';
                                }
                                break;
                        }
                    });

                    // Top Header Buttons Logic
                    const settingsOverlay = document.getElementById('settingsOverlay');
                    const historyOverlay = document.getElementById('historyOverlay');

                    document.getElementById('btnNewChat').addEventListener('click', () => {
                        chat.innerHTML = '';
                        chat.style.display = 'none';
                        emptyState.style.display = 'flex';
                    });
                    
                    document.getElementById('btnSettings').addEventListener('click', () => {
                        settingsOverlay.classList.add('open');
                    });
                    document.getElementById('closeSettings').addEventListener('click', () => {
                        settingsOverlay.classList.remove('open');
                    });
                    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'info', value: 'Settings saved successfully.' });
                        settingsOverlay.classList.remove('open');
                    });

                    document.getElementById('btnHistory').addEventListener('click', () => {
                        historyOverlay.classList.add('open');
                    });
                    document.getElementById('closeHistory').addEventListener('click', () => {
                        historyOverlay.classList.remove('open');
                    });
                    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'clearHistory' });
                    });
                    
                    const notifyFeature = (featureName) => {
                        vscode.postMessage({ type: 'info', value: featureName + ' features are currently in development.' });
                    };
                    
                    document.getElementById('btnOrg').addEventListener('click', () => notifyFeature('Organization Workspaces'));
                    document.getElementById('btnLayout').addEventListener('click', () => notifyFeature('Layout Customization'));
                    
                    // Account & Profile Logic
                    const accountOverlay = document.getElementById('accountOverlay');
                    document.getElementById('btnAccount').addEventListener('click', () => {
                        accountOverlay.classList.add('open');
                        vscode.postMessage({ type: 'loadProfile' });
                    });
                    
                    document.getElementById('closeAccount').addEventListener('click', () => {
                        accountOverlay.classList.remove('open');
                    });
                    
                    document.getElementById('btnSignup').addEventListener('click', () => {
                        const user = document.getElementById('authUsername').value;
                        const pass = document.getElementById('authPassword').value;
                        const conf = document.getElementById('authConfirm').value;
                        const error = document.getElementById('authError');
                        
                        if (!user || !pass) {
                            error.textContent = "Username and password required.";
                            error.style.display = "block";
                            return;
                        }
                        if (pass !== conf) {
                            error.textContent = "Passwords do not match.";
                            error.style.display = "block";
                            return;
                        }
                        
                        error.style.display = "none";
                        vscode.postMessage({ type: 'saveProfile', value: { username: user, password: pass } });
                    });
                    
                    document.getElementById('logoutBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'logout' });
                    });

                    // Model Hub Logic
                    const modelHubOverlay = document.getElementById('modelHubOverlay');
                    const btnModelHub = document.getElementById('btnModelHub');
                    const hubGridView = document.getElementById('hubGridView');
                    const hubConfigView = document.getElementById('hubConfigView');
                    
                    let currentEditingProvider = "";
                    
                    btnModelHub.addEventListener('click', () => {
                        modelHubOverlay.classList.add('open');
                        hubGridView.classList.remove('hidden');
                        hubConfigView.classList.remove('active');
                    });
                    
                    document.getElementById('closeModelHub').addEventListener('click', () => {
                        modelHubOverlay.classList.remove('open');
                    });
                    
                    document.getElementById('hubBackBtn').addEventListener('click', () => {
                        hubConfigView.classList.remove('active');
                        hubGridView.classList.remove('hidden');
                    });
                    
                    document.querySelectorAll('.provider-card').forEach(card => {
                        card.addEventListener('click', () => {
                            currentEditingProvider = card.dataset.provider;
                            document.getElementById('configProviderName').textContent = currentEditingProvider;
                            document.getElementById('configProviderLogo').src = card.querySelector('img') ? card.querySelector('img').src : '';
                            
                            // Adjust UI for Ollama, Custom API vs API Key
                            if (currentEditingProvider === 'Ollama' || currentEditingProvider === 'Custom API') {
                                document.getElementById('apiKeyGroup').style.display = 'flex';
                                document.getElementById('baseUrlGroup').style.display = 'flex';
                            } else {
                                document.getElementById('apiKeyGroup').style.display = 'flex';
                                document.getElementById('baseUrlGroup').style.display = 'none';
                            }
                            
                            // Pre-fill if it's the active provider
                            if (currentEditingProvider === activeProvider) {
                                document.getElementById('providerApiKey').value = activeApiKey;
                                document.getElementById('providerBaseUrl').value = activeBaseUrl || (currentEditingProvider === 'Custom API' ? "http://127.0.0.1:8000/v1" : "http://localhost:11434");
                            } else {
                                document.getElementById('providerApiKey').value = "";
                                document.getElementById('providerBaseUrl').value = currentEditingProvider === 'Custom API' ? "http://127.0.0.1:8000/v1" : "http://localhost:11434";
                                document.getElementById('providerModelSelect').innerHTML = '<option value="">Fetch models to select...</option>';
                            }
                            
                            hubGridView.classList.add('hidden');
                            hubConfigView.classList.add('active');
                        });
                    });
                    
                    document.getElementById('fetchModelsBtn').addEventListener('click', () => {
                        document.getElementById('providerModelSelect').innerHTML = '<option value="">Fetching...</option>';
                        vscode.postMessage({
                            type: 'fetchModels',
                            provider: currentEditingProvider,
                            apiKey: document.getElementById('providerApiKey').value,
                            baseUrl: document.getElementById('providerBaseUrl').value
                        });
                    });
                    
                    document.getElementById('saveProviderBtn').addEventListener('click', () => {
                        const sel = document.getElementById('providerModelSelect');
                        if (!sel.value) {
                            vscode.postMessage({ type: 'info', value: 'Please select a model first!' });
                            return;
                        }
                        
                        activeProvider = currentEditingProvider;
                        activeApiKey = document.getElementById('providerApiKey').value;
                        activeBaseUrl = document.getElementById('providerBaseUrl').value;
                        activeModel = sel.value;
                        
                        // Add to quick select if not exists
                        const existingIdx = configuredModels.findIndex(c => c.provider === activeProvider && c.modelId === activeModel);
                        if (existingIdx === -1) {
                            configuredModels.push({
                                provider: activeProvider,
                                apiKey: activeApiKey,
                                baseUrl: activeBaseUrl,
                                modelId: activeModel,
                                label: \`\${activeModel} (\${activeProvider})\`
                            });
                            renderModelMenu();
                        }
                        
                        document.getElementById('modelBtn').textContent = activeModel;
                        modelHubOverlay.classList.remove('open');
                        saveModelState();
                        vscode.postMessage({ type: 'info', value: \`Activated \${activeProvider} with model \${activeModel}\` });
                    });
                    
                    // --- Cat Eye Tracking Logic ---
                    const leftPupil = document.getElementById('pupil-left');
                    const rightPupil = document.getElementById('pupil-right');
                    const logoSvg = document.querySelector('.main-logo');
                    const promptInput = document.getElementById('prompt');
                    
                    let isTyping = false;
                    
                    document.addEventListener('mousemove', (e) => {
                        if (isTyping || !logoSvg || !leftPupil || !rightPupil) return;
                        
                        const rect = logoSvg.getBoundingClientRect();
                        const logoCenterX = rect.left + rect.width / 2;
                        const logoCenterY = rect.top + rect.height / 2;
                        
                        const dx = e.clientX - logoCenterX;
                        const dy = e.clientY - logoCenterY;
                        
                        const angle = Math.atan2(dy, dx);
                        // Restrict distance so pupil stays inside sclera (max 3px radius)
                        const distance = Math.min(Math.sqrt(dx*dx + dy*dy) / 40, 3);
                        
                        const moveX = Math.cos(angle) * distance;
                        const moveY = Math.sin(angle) * distance;
                        
                        leftPupil.style.transform = \`translate(\${moveX}px, \${moveY}px)\`;
                        rightPupil.style.transform = \`translate(\${moveX}px, \${moveY}px)\`;
                    });
                    
                    if (promptInput) {
                        promptInput.addEventListener('focus', () => {
                            isTyping = true;
                            if (leftPupil && rightPupil) {
                                // Look down towards the input box
                                leftPupil.style.transform = 'translate(0px, 3px)';
                                rightPupil.style.transform = 'translate(0px, 3px)';
                            }
                        });
                        promptInput.addEventListener('blur', () => {
                            isTyping = false;
                            if (leftPupil && rightPupil) {
                                leftPupil.style.transform = 'translate(0px, 0px)';
                                rightPupil.style.transform = 'translate(0px, 0px)';
                            }
                        });
                    }

                </script>
            </body>
            </html>
        `;
    }
}
