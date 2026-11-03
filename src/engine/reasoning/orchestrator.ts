import * as vscode from 'vscode';
import { ToolExecutor } from './executor';

export async function fetchProviderModels(provider: string, apiKey: string, baseUrl: string): Promise<{id: string, name?: string}[]> {
    try {
        if (provider === 'Ollama') {
            let reqHeaders: any = {};
            if (apiKey) reqHeaders['Authorization'] = `Bearer ${apiKey}`;
            const res = await fetch(`${baseUrl || 'http://localhost:11434'}/api/tags`, { headers: reqHeaders });
            if (!res.ok) throw new Error("Failed to fetch Ollama models");
            const data: any = await res.json();
            return (data.models || []).map((m: any) => ({ id: m.name, name: m.name }));
        }
        
        let url = '';
        let headers: any = { 'Authorization': `Bearer ${apiKey}` };
        
        if (provider === 'OpenAI') url = 'https://api.openai.com/v1/models';
        else if (provider === 'Groq') url = 'https://api.groq.com/openai/v1/models';
        else if (provider === 'xAI') url = 'https://api.x.ai/v1/models';
        else if (provider === 'Custom API') url = `${baseUrl || 'http://127.0.0.1:8000/v1'}/models`;
        else if (provider === 'Anthropic') {
            return [
                {id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet'},
                {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'},
                {id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku'}
            ];
        } else if (provider === 'Gemini') {
            return [
                {id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro'},
                {id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash'}
            ];
        } else if (provider === 'HuggingFace') {
            return [];
        }

        if (url) {
            try {
                const res = await fetch(url, { headers });
                if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
                const data: any = await res.json();
                return (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
            } catch (err) {
                if (provider === 'Custom API') {
                    // Fallback if the local gateway doesn't implement /models
                    return [{ id: 'local-model', name: 'Local Model' }];
                }
                throw err;
            }
        }

        return [];
    } catch (e: any) {
        vscode.window.showErrorMessage(`Fetch Models Error: ${e.message}`);
        return [];
    }
}

export class LLMOrchestrator {
    constructor(private provider: string, private apiKey: string, private baseUrl: string) {}

    public async askQuestion(question: string, contextPayload?: any, onProgress?: (msg: string) => void): Promise<string> {
        let prompt = question;
        if (contextPayload) {
            prompt = `Context Information:\n- Active File: ${contextPayload.activeFile}\n- Selection: ${contextPayload.selection || 'None'}\n- Diagnostics: ${contextPayload.diagnostics?.join(', ') || 'None'}\n\nFile Content:\n\`\`\`\n${contextPayload.fileContent}\n\`\`\`\n\nUser Question: ${question}\n\n>>> CRITICAL REMINDER: The user selected Target Language: "${contextPayload.language}". DO NOT ASK QUESTIONS. Generate the necessary files in ${contextPayload.language}. <<<`;
        }

        const context = contextPayload || {};
        let systemPrompt = context.systemPrompt || "You are CodeMind, an expert AI Engineering Intelligence Platform.";
        systemPrompt += "\n\nCRITICAL INTENT RULE: Analyze the user's intent before responding. If the user is just saying hello, asking a general question, or asking for an explanation, you MUST reply with natural conversational text only. DO NOT write code, do NOT use tools, and do NOT output [FILE:] tags unless the user explicitly asks you to write, edit, or generate code.";
        systemPrompt += "\n\nCRITICAL: DO NOT use emojis in your responses. Ensure your response is professional and headings are bolded. If you use a tool, only output a brief summary in the chat.";
        systemPrompt += "\n\nCRITICAL INSTRUCTION 1: If asked to build, create, or develop a project, website, or script, YOU MUST physically create the files using the `create_and_write_file` tool! DO NOT just output markdown code blocks in chat. You are an autonomous agent, WRITE THE FILES TO DISK. If tools fail, use this exact fallback syntax:\n[FILE: filename.ext]\ncode\n[/FILE]";
        systemPrompt += "\n\nCRITICAL INSTRUCTION 2: After creating the files, if the user asks you to run the code, you MUST use the `execute_terminal_command` tool. You must chain commands to install ALL missing libraries/packages AND run the code. Just execute it!";
        systemPrompt += "\n\nCRITICAL INSTRUCTION 3: The user expects massive, ENTERPRISE-LEVEL, production-ready code. Architect the solution beautifully with modular files. Output ALL tool calls simultaneously in parallel, or if using fallback, output ALL [FILE: path] blocks in this single response! Scaffold the ENTIRE project structure at once!";
        systemPrompt += "\n\nCRITICAL INSTRUCTION 4: If you use `execute_terminal_command` to start a web server, explicitly output the localhost URL (e.g., `http://localhost:3000`) in your chat response.";
        systemPrompt += "\n\nCRITICAL INSTRUCTION 5: When you execute a tool (like a terminal command), you will NOT see its output. The user sees it. DO NOT call the same tool repeatedly in a loop. Provide your final answer immediately after the tool call.";

        let messages: any[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];

        let finalAnswer = "";
        const isOpenAICompatible = ['OpenAI', 'Groq', 'xAI', 'Ollama', 'Custom API'].includes(this.provider);
        
        if (isOpenAICompatible) {
            let apiUrl = '';
            let headers: any = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };

            if (this.provider === 'OpenAI') apiUrl = 'https://api.openai.com/v1/chat/completions';
            else if (this.provider === 'Groq') apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            else if (this.provider === 'xAI') apiUrl = 'https://api.x.ai/v1/chat/completions';
            else if (this.provider === 'Custom API') apiUrl = `${this.baseUrl || 'http://127.0.0.1:8000/v1'}/chat/completions`;
            else if (this.provider === 'Ollama') {
                apiUrl = `${this.baseUrl || 'http://localhost:11434'}/v1/chat/completions`;
                if (!this.apiKey) {
                    delete headers['Authorization'];
                }
            }

            const body: any = {
                model: context.modelId,
                messages: messages,
                temperature: 0.2
            };

            if (context.mode === 'code') {
                body.tools = ToolExecutor.getToolsSchema();
                body.tool_choice = "auto";
            }

            try {
                let maxTurns = 15;
                let summary = "✅ **Enterprise Project Scaffolded Successfully!**\n\n**Actions Performed:**\n";
                let usedTools = false;

                for (let turn = 0; turn < maxTurns; turn++) {
                    const res = await fetch(apiUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body)
                    });
                    
                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`API Error ${res.status}: ${errText}`);
                    }

                    const data: any = await res.json();
                    const responseMessage = data.choices[0]?.message;

                    if (!responseMessage) throw new Error("No response generated.");

                    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                        usedTools = true;
                        messages.push(responseMessage);
                        
                        for (const toolCall of responseMessage.tool_calls) {
                            const functionName = toolCall.function.name;
                            let functionArgs: any = {};
                            try {
                                functionArgs = JSON.parse(toolCall.function.arguments);
                            } catch (e) {
                                // Ignore invalid json
                            }
                            
                            if (onProgress) onProgress(`Running ${functionName}...`);
                            const toolResult = await ToolExecutor.executeTool(functionName, functionArgs);
                            
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                name: functionName,
                                content: toolResult
                            });

                            if (functionName === 'create_and_write_file') {
                                summary += `- Created \`${functionArgs.filepath}\`\n`;
                            } else if (functionName === 'execute_terminal_command') {
                                summary += `- Executed \`${functionArgs.command}\`\n`;
                            } else {
                                summary += `- Used tool \`${functionName}\`\n`;
                            }
                        }
                        
                        body.messages = messages; // Update messages for the next turn
                    } else {
                        // Check for raw JSON tool calls in the text (like smaller local models output)
                        let contentStr = responseMessage.content || "";
                        if (contentStr.includes('"name"') && contentStr.includes('"arguments"')) {
                            let jsonBlocks = [];
                            let braceCount = 0;
                            let startIndex = -1;
                            
                            // Find outermost JSON objects
                            for (let i = 0; i < contentStr.length; i++) {
                                if (contentStr[i] === '{') {
                                    if (braceCount === 0) startIndex = i;
                                    braceCount++;
                                } else if (contentStr[i] === '}') {
                                    braceCount--;
                                    if (braceCount === 0 && startIndex !== -1) {
                                        jsonBlocks.push(contentStr.substring(startIndex, i + 1));
                                        startIndex = -1;
                                    }
                                }
                            }
                            
                            for (const block of jsonBlocks) {
                                try {
                                    const parsed = JSON.parse(block);
                                    if (parsed.name && parsed.arguments) {
                                        usedTools = true;
                                        // Execute tool
                                        if (onProgress) onProgress(`Running ${parsed.name}...`);
                                        const toolResult = await ToolExecutor.executeTool(parsed.name, parsed.arguments);
                                        
                                        if (parsed.name === 'create_and_write_file') {
                                            summary += `- Created \`${parsed.arguments.filepath}\`\n`;
                                        } else if (parsed.name === 'execute_terminal_command') {
                                            summary += `- Executed \`${parsed.arguments.command}\`\n`;
                                        } else {
                                            summary += `- Used tool \`${parsed.name}\`\n`;
                                        }
                                        
                                        // Remove the raw JSON block from the chat output
                                        contentStr = contentStr.replace(block, '');
                                    }
                                } catch (e) {
                                    // Not a valid JSON or tool call block
                                }
                            }
                            
                            responseMessage.content = contentStr;
                        }

                        if (usedTools) {
                            finalAnswer = summary + "\n" + (responseMessage.content || "");
                        } else {
                            finalAnswer = responseMessage.content || "";
                        }
                        break;
                    }
                }
            } catch (e: any) {
                vscode.window.showErrorMessage(`CodeMind Reasoning Error: ${e.message}`);
                throw e;
            }
        } else {
            // Anthropic & Gemini MVP fallback (we rely on [FILE:] syntax instead of native tools for them)
            finalAnswer = `Full direct integration for ${this.provider} is currently being built. Please use OpenAI, Groq, xAI, or Ollama for full tool execution.`;
        }

        // Fallback execution parsing
        if (context.mode === 'code') {
            // 1. Files
            const fileRegex = /\[FILE:\s*(.+?)\]([\s\S]*?)(?:\[\/FILE\]|(?=\[FILE:)|$)/gi;
            let match;
            while ((match = fileRegex.exec(finalAnswer)) !== null) {
                const filepath = match[1].trim();
                let content = match[2].trim();
                content = content.replace(/^```[\w]*\n/i, '').replace(/\n```$/i, '').trim();
                await ToolExecutor.executeTool('create_and_write_file', { filepath, content });
            }
            finalAnswer = finalAnswer.replace(fileRegex, (match, filepath) => {
                const filename = filepath.split(/[\/\\]/).pop();
                return `\n\n✅ *I have autonomously typed the code directly into your editor!*\n\n**File:** \`${filename}\`\n**Path:** \`${filepath}\`\n\n`;
            });

            // 2. Commands
            const cmdRegex = /\[COMMAND:\s*(.+?)\]/gi;
            let cmdMatch;
            while ((cmdMatch = cmdRegex.exec(finalAnswer)) !== null) {
                const cmd = cmdMatch[1].trim();
                await ToolExecutor.executeTool('execute_terminal_command', { command: cmd });
            }
            finalAnswer = finalAnswer.replace(cmdRegex, (match, cmd) => {
                return `\n\n⚙️ *Executing Command:* \`${cmd}\`\n\n`;
            });

            // 3. Browser
            const browserRegex = /\[BROWSER:\s*(.+?)\]/gi;
            let browserMatch;
            while ((browserMatch = browserRegex.exec(finalAnswer)) !== null) {
                const url = browserMatch[1].trim();
                await ToolExecutor.executeTool('open_browser', { url });
            }
            finalAnswer = finalAnswer.replace(browserRegex, (match, url) => {
                return `\n\n🌐 *Opening Preview Browser at:* [${url}](${url})\n\n`;
            });
        }

        return finalAnswer;
    }
}
