import Groq from 'groq-sdk';
import * as vscode from 'vscode';
import { ToolExecutor } from './executor';

// Provide API key via environment variable or Extension settings
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export class GroqReasoner {
    private groq: Groq;

    constructor() {
        this.groq = new Groq({
            apiKey: GROQ_API_KEY
        });
    }

    /**
     * Ask a question to the Groq reasoning brain.
     */
    public async askQuestion(question: string, contextPayload?: any): Promise<string> {
        try {
            let prompt = question;
            if (contextPayload) {
                prompt = `
Context Information:
- Active File: ${contextPayload.activeFile}
- Selection: ${contextPayload.selection || 'None'}
- Diagnostics: ${contextPayload.diagnostics?.join(', ') || 'None'}

File Content:
\`\`\`
${contextPayload.fileContent}
\`\`\`

User Question: ${question}

>>> CRITICAL REMINDER: You MUST write your response and all code in the selected language: "${contextPayload.language}". If the selected language is C#, you MUST output C# code with a .cs extension. DO NOT default to the language of the active file! <<<`;
            }

            const context = contextPayload || {};
            let systemPrompt = context.systemPrompt || "You are CodeMind, an expert AI Engineering Intelligence Platform.";
            
            systemPrompt += "\n\nCRITICAL: DO NOT use emojis in your responses. Ensure your response is professional and headings are bolded. If you use a tool, only output a brief summary in the chat.";

            let messages: any[] = [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: prompt,
                }
            ];

            let finalAnswer = "";

            while (true) {
                const reqOptions: any = {
                    messages: messages,
                    model: context.modelId || "openai/gpt-oss-120b",
                    temperature: 0.2
                };
                
                // ONLY attach tools if in 'code' mode. This dramatically reduces latency for standard questions.
                if (context.mode === 'code') {
                    reqOptions.tools = ToolExecutor.getToolsSchema();
                    reqOptions.tool_choice = "auto";
                }

                const chatCompletion = await this.groq.chat.completions.create(reqOptions);

                const responseMessage = chatCompletion.choices[0]?.message;

                if (!responseMessage) {
                    finalAnswer = "CodeMind encountered an error generating a response.";
                    break;
                }

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    // Model decided to call tools
                    messages.push(responseMessage); 

                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        
                        // Notify UI if possible (optional, but good UX)
                        
                        // Execute tool locally
                        const functionResponse = await ToolExecutor.executeTool(functionName, functionArgs);
                        
                        // Send result back to LLM
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: functionName,
                            content: functionResponse,
                        });
                    }
                } else {
                    // Normal text response
                    finalAnswer = responseMessage.content || "No response generated.";
                    break;
                }
            }

            // Fallback & Guaranteed Execution: Parse custom [FILE:] blocks and type them into the editor
            if (context.mode === 'code') {
                const fileRegex = /\[FILE:\s*(.+?)\]([\s\S]*?)\[\/FILE\]/g;
                let match;
                while ((match = fileRegex.exec(finalAnswer)) !== null) {
                    const filepath = match[1].trim();
                    const content = match[2].trim();
                    
                    // Trigger the live typing effect!
                    await ToolExecutor.executeTool('create_and_write_file', { filepath, content });
                }
                
                // Strip the raw code from the chat and show the filename/path clearly
                finalAnswer = finalAnswer.replace(fileRegex, (match, filepath) => {
                    const filename = filepath.split(/[\/\\]/).pop();
                    return `\n\n✅ *I have autonomously typed the code directly into your editor!*\n\n**File:** \`${filename}\`\n**Path:** \`${filepath}\`\n\n`;
                });
            }

            return finalAnswer;
        } catch (error: any) {
            vscode.window.showErrorMessage(`CodeMind Reasoning Error: ${error.message}`);
            throw error;
        }
    }
}
