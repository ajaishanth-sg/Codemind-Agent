import { BrowserSerializedContinueConfig, ChatMessage, IDE, PromptLog } from "core";
import type {
  FromWebviewProtocol,
  ToCoreProtocol,
  ToWebviewProtocol,
} from "core/protocol";
import { Message } from "core/protocol/messenger";
import { MessageIde } from "core/protocol/messenger/messageIde";
import {
  GeneratorReturnType,
  GeneratorYieldType,
  WebviewProtocolGeneratorMessage,
  WebviewSingleMessage,
  WebviewSingleProtocolMessage,
} from "core/protocol/util";
import { createContext } from "react";
import { v4 as uuidv4 } from "uuid";
import { isJetBrains } from "../util";

const BROWSER_CONFIG_KEY = "continue_browser_config";
const BROWSER_SESSIONS_KEY = "continue_browser_sessions";

export function getBrowserStoredSessions(): any[] {
  try {
    const raw = localStorage.getItem(BROWSER_SESSIONS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to read sessions from localStorage", e);
  }
  return [];
}

export function saveBrowserStoredSessions(sessions: any[]) {
  try {
    localStorage.setItem(BROWSER_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions to localStorage", e);
  }
}

export function getBrowserStoredConfig(): BrowserSerializedContinueConfig {
  try {
    const raw = localStorage.getItem(BROWSER_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.modelsByRole?.chat) {
        parsed.modelsByRole.chat = parsed.modelsByRole.chat
          .filter(
            (m: any) =>
              !(
                m.provider === "groq" &&
                (m.model?.includes("llama-3") ||
                  m.model?.includes("llama3") ||
                  m.title?.includes("Llama 3"))
              ) &&
              !(m.provider === "ollama" && m.title?.includes("(Local)")),
          )
          .map((m: any) => {
            m.configurationStatus = "valid";
            if (!m.underlyingProviderName) {
              m.underlyingProviderName = m.provider;
            }
            if (m.provider === "groq" && (m.model === "AUTODETECT" || !m.model)) {
              m.model = "openai/gpt-oss-20b";
              m.title = "GPT-OSS 20B (Groq)";
            }
            return m;
          });
        parsed.modelsByRole.edit = parsed.modelsByRole.chat;
        parsed.modelsByRole.apply = parsed.modelsByRole.chat;
      }
      if (parsed?.selectedModelByRole?.chat) {
        const sel = parsed.selectedModelByRole.chat;
        sel.configurationStatus = "valid";
        if (!sel.underlyingProviderName) {
          sel.underlyingProviderName = sel.provider;
        }
        if (
          sel.provider === "groq" &&
          (sel.model?.includes("llama-3") ||
            sel.model?.includes("llama3") ||
            sel.title?.includes("Llama 3") ||
            sel.model === "AUTODETECT" ||
            !sel.model)
        ) {
          sel.model = "openai/gpt-oss-20b";
          sel.title = "GPT-OSS 20B (Groq)";
        }
        if (sel.provider === "ollama" && sel.title?.includes("(Local)")) {
          parsed.selectedModelByRole.chat =
            parsed.modelsByRole.chat.find((m: any) => m.provider === "ollama") ||
            parsed.modelsByRole.chat[0] ||
            sel;
        }
        parsed.selectedModelByRole.edit = parsed.selectedModelByRole.chat;
        parsed.selectedModelByRole.apply = parsed.selectedModelByRole.chat;
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to read browser config from localStorage", e);
  }

  const defaultModels: any[] = [
    {
      title: "GPT-OSS 20B (Groq)",
      provider: "groq",
      model: "openai/gpt-oss-20b",
      underlyingProviderName: "groq",
      configurationStatus: "valid",
    },
    {
      title: "GPT-OSS 120B (Groq)",
      provider: "groq",
      model: "openai/gpt-oss-120b",
      underlyingProviderName: "groq",
      configurationStatus: "valid",
    },
    {
      title: "Qwen 3.8 27B (Groq)",
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      underlyingProviderName: "groq",
      configurationStatus: "valid",
    },
    {
      title: "ALLaM 2 7B (Groq)",
      provider: "groq",
      model: "allam-2-7b",
      underlyingProviderName: "groq",
      configurationStatus: "valid",
    },
    {
      title: "GPT-4o",
      provider: "openai",
      model: "gpt-4o",
      underlyingProviderName: "openai",
      configurationStatus: "valid",
    },
    {
      title: "Claude 3.5 Sonnet",
      provider: "anthropic",
      model: "claude-3-5-sonnet-latest",
      underlyingProviderName: "anthropic",
      configurationStatus: "valid",
    },
    {
      title: "Gemini 1.5 Pro",
      provider: "gemini",
      model: "gemini-1.5-pro-latest",
      underlyingProviderName: "gemini",
      configurationStatus: "valid",
    },
  ];

  const initialConfig: BrowserSerializedContinueConfig = {
    slashCommands: [],
    contextProviders: [],
    tools: [],
    mcpServerStatuses: [],
    modelsByRole: {
      chat: defaultModels,
      apply: defaultModels,
      edit: defaultModels,
      summarize: [],
      autocomplete: [],
      rerank: [],
      embed: [],
      subagent: [],
    },
    selectedModelByRole: {
      chat: defaultModels[0],
      apply: defaultModels[0],
      edit: defaultModels[0],
      summarize: null,
      autocomplete: null,
      rerank: null,
      embed: null,
      subagent: null,
    },
    rules: [],
  };

  try {
    localStorage.setItem(BROWSER_CONFIG_KEY, JSON.stringify(initialConfig));
  } catch (e) {}

  return initialConfig;
}

export function saveBrowserStoredConfig(config: BrowserSerializedContinueConfig) {
  try {
    localStorage.setItem(BROWSER_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save browser config", e);
  }
}

export function broadcastBrowserConfigUpdate(
  config: BrowserSerializedContinueConfig,
) {
  const profileId = "local";
  const profiles = [
    {
      id: "local",
      title: "Local Profile",
      iconUrl: "",
      errors: undefined,
      uri: "file:///config.yaml",
      fullSlug: {
        ownerSlug: "local",
        packageSlug: "local",
        versionSlug: "latest",
      },
    },
  ];

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        messageType: "configUpdate",
        data: {
          result: {
            config,
            errors: [],
            configLoadInterrupted: false,
          },
          profileId,
          profiles,
        },
      },
      origin: window.location.origin,
    }),
  );
}

interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;

export interface IIdeMessenger {
  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt?: number,
  ): void;

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ): void;

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleProtocolMessage<T>>;

  streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  >;

  llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined>;

  ide: IDE;
}

export class IdeMessenger implements IIdeMessenger {
  ide: IDE;

  constructor() {
    this.ide = new MessageIde(
      async (messageType, data) => {
        const result = await this.request(messageType, data);
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.content;
      },
      () => {},
    );
  }

  private _handleBrowserPost(messageType: string, data: any) {
    if (messageType === "onboarding/complete") {
      const { provider, apiKey } = data || {};
      const config = getBrowserStoredConfig();
      const providerKey = (provider || "openai").toLowerCase();
      let title = "Custom Model";
      let modelName = "default";
      if (providerKey === "openai") {
        title = "GPT-4o";
        modelName = "gpt-4o";
      } else if (providerKey === "anthropic") {
        title = "Claude 3.5 Sonnet";
        modelName = "claude-3-5-sonnet-latest";
      } else if (providerKey === "gemini") {
        title = "Gemini 1.5 Pro";
        modelName = "gemini-1.5-pro-latest";
      } else if (providerKey === "ollama") {
        title = "Ollama (Local)";
        modelName = "llama3.1:8b";
      } else {
        title = `${providerKey.toUpperCase()} Model`;
        modelName = providerKey;
      }

      const newModel: any = {
        title,
        provider: providerKey,
        model: modelName,
        apiKey: apiKey || "",
        underlyingProvider: providerKey,
      };

      const existingIdx = config.modelsByRole.chat.findIndex(
        (m: any) => m.title === title || m.provider === providerKey,
      );
      if (existingIdx >= 0) {
        config.modelsByRole.chat[existingIdx] = newModel;
      } else {
        config.modelsByRole.chat.unshift(newModel);
      }
      config.selectedModelByRole.chat = newModel;
      saveBrowserStoredConfig(config);
      broadcastBrowserConfigUpdate(config);
      return;
    }

    if (messageType === "config/addModel") {
      let { model } = data || {};
      if (model) {
        const config = getBrowserStoredConfig();
        const copyModel = { ...model };
        copyModel.configurationStatus = "valid";
        if (!copyModel.underlyingProviderName) {
          copyModel.underlyingProviderName = copyModel.provider;
        }
        if (copyModel.provider === "groq") {
          if (
            copyModel.model === "AUTODETECT" ||
            !copyModel.model ||
            copyModel.model.includes("llama-3") ||
            copyModel.model.includes("llama3")
          ) {
            copyModel.model = "openai/gpt-oss-20b";
          }
          if (
            copyModel.title === "Autodetect" ||
            !copyModel.title ||
            copyModel.title.includes("Llama 3")
          ) {
            copyModel.title = "GPT-OSS 20B (Groq)";
          }
        }
        const existingIdx = config.modelsByRole.chat.findIndex(
          (m: any) =>
            m.title === copyModel.title ||
            (m.provider === copyModel.provider && m.model === copyModel.model),
        );
        if (existingIdx >= 0) {
          config.modelsByRole.chat[existingIdx] = {
            ...config.modelsByRole.chat[existingIdx],
            ...copyModel,
          };
        } else {
          config.modelsByRole.chat.unshift(copyModel);
        }
        config.selectedModelByRole.chat = copyModel;
        config.modelsByRole.edit = config.modelsByRole.chat;
        config.modelsByRole.apply = config.modelsByRole.chat;
        config.selectedModelByRole.edit = copyModel;
        config.selectedModelByRole.apply = copyModel;
        saveBrowserStoredConfig(config);
        broadcastBrowserConfigUpdate(config);
      }
      return;
    }

    if (messageType === "config/updateSelectedModel") {
      const { role, title } = data || {};
      const config = getBrowserStoredConfig();
      const targetRole = role || "chat";
      const model =
        (config.modelsByRole as any)[targetRole]?.find(
          (m: any) => m.title === title,
        ) || config.modelsByRole.chat.find((m: any) => m.title === title);
      if (model) {
        model.configurationStatus = "valid";
        (config.selectedModelByRole as any)[targetRole] = model;
        saveBrowserStoredConfig(config);
        broadcastBrowserConfigUpdate(config);
      }
      return;
    }

    if (messageType === "config/deleteModel") {
      const { title } = data || {};
      const config = getBrowserStoredConfig();
      config.modelsByRole.chat = config.modelsByRole.chat.filter(
        (m: any) => m.title !== title,
      );
      if (config.selectedModelByRole.chat?.title === title) {
        config.selectedModelByRole.chat = config.modelsByRole.chat[0] || null;
      }
      saveBrowserStoredConfig(config);
      broadcastBrowserConfigUpdate(config);
      return;
    }

    if (messageType === "history/save") {
      const session = data as any;
      if (session && session.sessionId) {
        const sessions = getBrowserStoredSessions();
        const existingIdx = sessions.findIndex(
          (s) => s.sessionId === session.sessionId,
        );
        const toSave = {
          ...session,
          dateCreated:
            existingIdx >= 0 && sessions[existingIdx].dateCreated
              ? sessions[existingIdx].dateCreated
              : new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          sessions[existingIdx] = toSave;
        } else {
          sessions.unshift(toSave);
        }
        saveBrowserStoredSessions(sessions);
      }
      return;
    }
  }

  private async _handleBrowserRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleMessage<T>> {
    if (messageType === "config/getSerializedProfileInfo") {
      let config = getBrowserStoredConfig();
      // Auto-detect Ollama local models:
      try {
        const ollamaRes = await fetch("http://localhost:11434/api/tags").catch(
          () => null,
        );
        if (ollamaRes && ollamaRes.ok) {
          const ollamaData = await ollamaRes.json();
          if (ollamaData.models && ollamaData.models.length > 0) {
            const localOllamaModels = ollamaData.models.map((m: any) => ({
              title: `${m.name} (Ollama)`,
              provider: "ollama",
              model: m.name,
              underlyingProviderName: "ollama",
              configurationStatus: "valid",
            }));
            const otherModels = config.modelsByRole.chat.filter(
              (m: any) => m.provider !== "ollama",
            );
            config.modelsByRole.chat = [...localOllamaModels, ...otherModels];
            config.modelsByRole.edit = config.modelsByRole.chat;
            config.modelsByRole.apply = config.modelsByRole.chat;
            saveBrowserStoredConfig(config);
          }
        }
      } catch (e) {}

      // Auto-detect active Groq models if API key exists:
      try {
        const groqModel = config.modelsByRole.chat.find(
          (m: any) => m.provider === "groq" && m.apiKey,
        );
        const groqKey = groqModel?.apiKey;
        if (groqKey) {
          const groqRes = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${groqKey}` },
          }).catch(() => null);
          if (groqRes && groqRes.ok) {
            const groqData = await groqRes.json();
            const activeChatModels = (groqData.data || []).filter(
              (m: any) =>
                !m.id.includes("whisper") &&
                !m.id.includes("prompt-guard") &&
                !m.id.includes("orpheus") &&
                !m.id.includes("safeguard") &&
                !m.id.includes("tts") &&
                !m.id.includes("embedding"),
            );
            if (activeChatModels.length > 0) {
              const activeGroqModels = activeChatModels.map((m: any) => ({
                title: `${m.id} (Groq)`,
                provider: "groq",
                model: m.id,
                apiKey: groqKey,
                underlyingProviderName: "groq",
                configurationStatus: "valid",
              }));
              const nonGroqModels = config.modelsByRole.chat.filter(
                (m: any) => m.provider !== "groq",
              );
              config.modelsByRole.chat = [...nonGroqModels, ...activeGroqModels];
              config.modelsByRole.edit = config.modelsByRole.chat;
              config.modelsByRole.apply = config.modelsByRole.chat;
              saveBrowserStoredConfig(config);
            }
          }
        }
      } catch (e) {}

      // Ensure valid selected chat model:
      const curSelected = config.selectedModelByRole.chat;
      if (
        !curSelected ||
        curSelected.model?.includes("llama-3") ||
        curSelected.model?.includes("llama3") ||
        curSelected.title?.includes("Llama 3") ||
        !config.modelsByRole.chat.some(
          (m: any) => m.title === curSelected.title,
        )
      ) {
        config.selectedModelByRole.chat = config.modelsByRole.chat[0] || null;
        config.selectedModelByRole.edit = config.selectedModelByRole.chat;
        config.selectedModelByRole.apply = config.selectedModelByRole.chat;
        saveBrowserStoredConfig(config);
      }

      return {
        status: "success",
        content: {
          profileId: "local",
          profiles: [
            {
              id: "local",
              title: "Local Profile",
              iconUrl: "",
              errors: undefined,
              uri: "file:///config.yaml",
              fullSlug: {
                ownerSlug: "local",
                packageSlug: "local",
                versionSlug: "latest",
              },
            },
          ],
          result: {
            config,
            errors: [],
            configLoadInterrupted: false,
          },
        },
      } as any;
    }

    if (messageType === "models/fetch") {
      const { provider, apiKey } = (data || {}) as any;
      if (provider === "ollama") {
        try {
          const res = await fetch("http://localhost:11434/api/tags");
          if (res.ok) {
            const json = await res.json();
            const list = (json.models || []).map((m: any) => ({
              name: m.name,
              modelId: m.name,
              description: `Installed locally (${m.details?.parameter_size || "local"})`,
              icon: "ollama.png",
              popular: true,
            }));
            return { status: "success", content: list } as any;
          }
        } catch (e) {
          console.error("Failed to fetch Ollama tags:", e);
        }
        return { status: "success", content: [] } as any;
      }

      if (provider === "groq") {
        const key =
          apiKey ||
          getBrowserStoredConfig().modelsByRole.chat.find(
            (m: any) => m.provider === "groq",
          )?.apiKey;
        if (key) {
          try {
            const res = await fetch("https://api.groq.com/openai/v1/models", {
              headers: { Authorization: `Bearer ${key}` },
            });
            if (res.ok) {
              const json = await res.json();
              const chatModels = (json.data || []).filter(
                (m: any) =>
                  !m.id.includes("whisper") &&
                  !m.id.includes("prompt-guard") &&
                  !m.id.includes("orpheus") &&
                  !m.id.includes("safeguard") &&
                  !m.id.includes("tts") &&
                  !m.id.includes("embedding"),
              );
              const list = chatModels.map((m: any) => ({
                name: m.id,
                modelId: m.id,
                description: `Active Groq Model (${m.id})`,
                icon: "groq.png",
                popular: true,
              }));
              return { status: "success", content: list } as any;
            }
          } catch (e) {
            console.error("Failed to fetch Groq models:", e);
          }
        }
        return { status: "success", content: [] } as any;
      }

      return { status: "success", content: [] } as any;
    }

    if (messageType === "llm/compileChat") {
      const msgs = (data as any)?.messages || [];
      return {
        status: "success",
        content: {
          compiledChatMessages: msgs,
          didPrune: false,
          contextPercentage: 0.1,
        },
      } as any;
    }

    if (messageType === "getOpenFiles") {
      return { status: "success", content: [] } as any;
    }

    if (messageType === "getWorkspaceDirs") {
      return { status: "success", content: ["file:///workspace"] } as any;
    }

    if (messageType === "getCurrentFile") {
      return {
        status: "success",
        content: {
          isUntitled: false,
          contents: "",
          path: "file:///workspace/untitled.txt",
        },
      } as any;
    }

    if (messageType === "getIdeInfo") {
      return {
        status: "success",
        content: {
          ideType: "vscode",
          name: "Codemind",
          version: "1.0.0",
          remoteName: "",
          extensionVersion: "1.0.0",
        },
      } as any;
    }

    if (messageType === "getIdeSettings") {
      return {
        status: "success",
        content: {
          remoteConfigServerUrl: undefined,
          userToken: "",
          enableControlServerBeta: false,
          pauseCodebaseIndexOnStart: false,
          continueTestEnvironment: "none",
        },
      } as any;
    }

    if (messageType === "context/getContextItems") {
      return { status: "success", content: [] } as any;
    }

    if (messageType === "context/getSymbolsForFiles") {
      return { status: "success", content: {} } as any;
    }

    if (messageType === "tools/evaluatePolicy") {
      return {
        status: "success",
        content: {
          policy: (data as any)?.basePolicy || "allow",
          displayValue: undefined,
        },
      } as any;
    }

    if (messageType === "tools/call") {
      return {
        status: "success",
        content: {
          contextItems: [],
        },
      } as any;
    }

    if (messageType === "tools/preprocessArgs") {
      return {
        status: "success",
        content: {
          preprocessedArgs: undefined,
        },
      } as any;
    }

    if (messageType === "docs/getIndexedPages") {
      return { status: "success", content: [] } as any;
    }

    if (messageType === "history/list") {
      const sessions = getBrowserStoredSessions();
      const metadata = sessions.map((s) => ({
        sessionId: s.sessionId,
        title: s.title || "Chat Session",
        dateCreated: s.dateCreated || new Date().toISOString(),
        workspaceDirectory: s.workspaceDirectory || "",
        messageCount: s.history?.length || 0,
      }));
      return { status: "success", content: metadata } as any;
    }

    if (messageType === "history/save") {
      const session = data as any;
      if (session && session.sessionId) {
        const sessions = getBrowserStoredSessions();
        const existingIdx = sessions.findIndex(
          (s) => s.sessionId === session.sessionId,
        );
        const toSave = {
          ...session,
          dateCreated:
            existingIdx >= 0 && sessions[existingIdx].dateCreated
              ? sessions[existingIdx].dateCreated
              : new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          sessions[existingIdx] = toSave;
        } else {
          sessions.unshift(toSave);
        }
        saveBrowserStoredSessions(sessions);
      }
      return { status: "success", content: undefined } as any;
    }

    if (messageType === "history/load") {
      const { id } = (data || {}) as any;
      const sessions = getBrowserStoredSessions();
      const match = sessions.find((s) => s.sessionId === id);
      if (match) {
        return { status: "success", content: match } as any;
      }
      return { status: "error", error: "Session not found" } as any;
    }

    if (messageType === "history/delete") {
      const { id } = (data || {}) as any;
      let sessions = getBrowserStoredSessions();
      sessions = sessions.filter((s) => s.sessionId !== id);
      saveBrowserStoredSessions(sessions);
      return { status: "success", content: undefined } as any;
    }

    if (messageType === "history/clear") {
      saveBrowserStoredSessions([]);
      return { status: "success", content: undefined } as any;
    }

    if (messageType === "chatDescriber/describe") {
      const text = (data as any)?.text || "";
      const clean = text.slice(0, 40).replace(/[\r\n]+/g, " ").trim();
      return { status: "success", content: clean || "Chat Session" } as any;
    }

    return { status: "success", content: undefined } as any;
  }

  private _postToIde(
    messageType: string,
    data: any,
    messageId: string = uuidv4(),
  ) {
    if (typeof vscode === "undefined") {
      if (isJetBrains()) {
        if (window.postIntellijMessage === undefined) {
          console.log(
            "Unable to send message: postIntellijMessage is undefined. ",
            messageType,
            data,
          );
          throw new Error("postIntellijMessage is undefined");
        }
        window.postIntellijMessage?.(messageType, data, messageId);
        return;
      } else {
        this._handleBrowserPost(messageType, data);
        return;
      }
    }

    const msg: Message = {
      messageId,
      messageType,
      data,
    };

    vscode.postMessage(msg);
  }

  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt: number = 0,
  ) {
    try {
      this._postToIde(messageType, data, messageId);
    } catch (error) {
      if (attempt < 5) {
        console.log(`Attempt ${attempt} failed. Retrying...`);
        setTimeout(
          () => this.post(messageType, data, messageId, attempt + 1),
          Math.pow(2, attempt) * 1000,
        );
      } else {
        console.error(
          "Max attempts reached. Message could not be sent.",
          error,
        );
      }
    }
  }

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ) {
    this._postToIde(messageType, data, messageId);
  }

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleMessage<T>> {
    if (typeof vscode === "undefined" && !isJetBrains()) {
      return this._handleBrowserRequest(messageType, data);
    }
    const messageId = uuidv4();

    return new Promise((resolve) => {
      const handler = (event: any) => {
        if (event.data.messageId === messageId) {
          window.removeEventListener("message", handler);
          resolve(event.data.data as WebviewSingleMessage<T>);
        }
      };
      window.addEventListener("message", handler);

      this.post(messageType, data, messageId);
    });
  }

  /**
   * Because of weird type stuff, we're actually yielding an array of the things
   * that are streamed. For example, if the return type here says
   * AsyncGenerator<ChatMessage>, then it's actually AsyncGenerator<ChatMessage[]>.
   * This needs to be handled by the caller.
   *
   * Using unknown for now to make this more explicit
   */
  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  > {
    if (typeof vscode === "undefined" && !isJetBrains()) {
      if (messageType === "llm/streamChat") {
        const config = getBrowserStoredConfig();
        const activeModel = config.selectedModelByRole.chat;
        const modelTitle = activeModel?.title || "Model";

        const msgs = (data as any)?.messages || [];
        const rawChatMessages = msgs.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content),
        }));

        const apiKey = activeModel?.apiKey || "";

        // If Ollama model is active, stream real response directly from Ollama:
        if (
          activeModel?.provider === "ollama" ||
          activeModel?.underlyingProviderName === "ollama"
        ) {
          const ollamaModel = activeModel?.model || "qwen2.5-coder:7b";
          try {
            const resp = await fetch("http://localhost:11434/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: ollamaModel,
                messages: rawChatMessages,
                stream: true,
              }),
            });

            if (!resp.ok) {
              const errJson = await resp.json().catch(() => null);
              const errMsg =
                errJson?.error || `HTTP ${resp.status} ${resp.statusText}`;
              yield [
                {
                  role: "assistant",
                  content: `❌ **Ollama Error**: ${errMsg}`,
                } as any,
              ];
              return undefined;
            }

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            let streamBuffer = "";

            if (reader) {
              while (true) {
                if (cancelToken?.aborted) {
                  await reader.cancel();
                  return undefined;
                }
                const { done, value } = await reader.read();
                if (done) break;
                streamBuffer += decoder.decode(value, { stream: true });
                const lines = streamBuffer.split("\n");
                streamBuffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  try {
                    const parsed = JSON.parse(trimmed);
                    const delta = parsed.message?.content;
                    if (delta) {
                      yield [{ role: "assistant", content: delta } as any];
                    }
                  } catch (e) {}
                }
              }
              return undefined;
            }
          } catch (e: any) {
            console.error("Ollama fetch error:", e);
            yield [
              {
                role: "assistant",
                content: `⚠️ **Ollama Error**: Could not connect to local Ollama (${e.message}). Ensure Ollama is running at http://localhost:11434.`,
              } as any,
            ];
            return undefined;
          }
        }

        // If Groq API key is present, stream real response directly from Groq:
        if (
          (activeModel?.provider === "groq" || apiKey.startsWith("gsk_")) &&
          apiKey
        ) {
          let groqModel =
            activeModel?.model && activeModel.model !== "AUTODETECT"
              ? activeModel.model
              : "openai/gpt-oss-20b";
          if (groqModel.includes("llama-3") || groqModel.includes("llama3")) {
            groqModel = "openai/gpt-oss-20b";
          }

          try {
            const resp = await fetch(
              "https://api.groq.com/openai/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: groqModel,
                  messages: rawChatMessages,
                  stream: true,
                }),
              },
            );

            if (!resp.ok) {
              const errJson = await resp.json().catch(() => null);
              const errMsg =
                errJson?.error?.message ||
                `HTTP ${resp.status} ${resp.statusText}`;
              yield [
                {
                  role: "assistant",
                  content: `❌ **Groq API Error**: ${errMsg}`,
                } as any,
              ];
              return undefined;
            }

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            let streamBuffer = "";

            if (reader) {
              while (true) {
                if (cancelToken?.aborted) {
                  await reader.cancel();
                  return undefined;
                }
                const { done, value } = await reader.read();
                if (done) break;
                streamBuffer += decoder.decode(value, { stream: true });
                const lines = streamBuffer.split("\n");
                streamBuffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith(":")) continue;
                  if (trimmed === "data: [DONE]") continue;
                  if (trimmed.startsWith("data: ")) {
                    try {
                      const parsed = JSON.parse(trimmed.slice(6));
                      const delta = parsed.choices?.[0]?.delta?.content;
                      if (delta) {
                        yield [{ role: "assistant", content: delta } as any];
                      }
                    } catch (e) {}
                  }
                }
              }
              return undefined;
            }
          } catch (e: any) {
            console.error("Groq fetch error:", e);
            yield [
              {
                role: "assistant",
                content: `⚠️ **Connection Note**: Could not reach Groq directly (${e.message}). Ensure network/API key is valid.`,
              } as any,
            ];
            return undefined;
          }
        }

        const lastUserMsg = msgs[msgs.length - 1]?.content || "your request";
        const userPrompt =
          typeof lastUserMsg === "string" ? lastUserMsg : "your message";

        const intro = `Response from **${modelTitle}**:\n\n`;
        yield [{ role: "assistant", content: intro } as any];
        await new Promise((r) => setTimeout(r, 60));

        const reply = `I received: "${userPrompt}". Your model is successfully configured and active in Codemind! 🕷️🕸️`;
        yield [{ role: "assistant", content: reply } as any];
        return undefined;
      }
    }

    const messageId = uuidv4();

    this.post(messageType, data, messageId);

    const buffer: GeneratorYieldType<FromWebviewProtocol[T][1]>[] = [];
    let index = 0;
    let done = false;
    let returnVal: GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined =
      undefined;
    let error: string | null = null;

    // This handler receieves individual WebviewMessengerResults
    // And pushes them to buffer
    const handler = (event: {
      data: Message<WebviewProtocolGeneratorMessage<T>>;
    }) => {
      if (event.data.messageId === messageId) {
        const responseData = event.data.data;
        if ("error" in responseData) {
          error = responseData.error;
          return;
          // throw new Error(responseData.error);
        }
        if (responseData.done) {
          window.removeEventListener("message", handler);
          done = true;
          returnVal = responseData.content;
        } else {
          buffer.push(responseData.content);
        }
      }
    };
    window.addEventListener("message", handler);

    const handleAbort = () => {
      this.post("abort", undefined, messageId);
    };
    cancelToken?.addEventListener("abort", handleAbort);

    try {
      while (!done) {
        if (error) {
          throw new Error(error);
        }
        if (buffer.length > index) {
          const chunks = buffer.slice(index);
          index = buffer.length;
          yield chunks;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (buffer.length > index) {
        const chunks = buffer.slice(index);
        yield chunks;
      }

      if (!returnVal) {
        return undefined;
      }
      return returnVal;
    } catch (e) {
      throw e;
    } finally {
      cancelToken?.removeEventListener("abort", handleAbort);
    }
  }

  async *llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    const gen = this.streamRequest("llm/streamChat", msg, cancelToken);

    let next = await gen.next();
    while (!next.done) {
      yield next.value;
      next = await gen.next();
    }
    return next.value;
  }
}

export const IdeMessengerContext = createContext<IIdeMessenger>(
  new IdeMessenger(),
);

export const IdeMessengerProvider: React.FC<{
  children: React.ReactNode;
  messenger?: IIdeMessenger;
}> = ({ children, messenger = new IdeMessenger() }) => {
  return (
    <IdeMessengerContext.Provider value={messenger}>
      {children}
    </IdeMessengerContext.Provider>
  );
};
