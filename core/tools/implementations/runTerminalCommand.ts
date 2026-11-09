import iconv from "iconv-lite";
import childProcess from "node:child_process";
import os from "node:os";
import { ContinueError, ContinueErrorReason } from "../../util/errors";

// Default timeout for terminal commands (2 minutes)
const DEFAULT_TOOL_TIMEOUT_MS = 120_000;

// Automatically decode the buffer according to the platform to avoid garbled Chinese
function getDecodedOutput(data: Buffer): string {
  if (process.platform === "win32") {
    try {
      let out = iconv.decode(data, "utf-8");
      if (/�/.test(out)) {
        out = iconv.decode(data, "gbk");
      }
      return out;
    } catch {
      return iconv.decode(data, "gbk");
    }
  } else {
    return data.toString();
  }
} // Helper function to sanitize commands on Windows
function sanitizeWindowsCommand(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }

  let cleaned = command.trim();

  // Strip code block fences if present: ```bash ... ```
  const fenceMatch = cleaned.match(
    /^```(?:bash|sh|powershell|cmd|ps1)?\s*([\s\S]*?)\s*```$/i,
  );
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Strip `bash -lc "..."`, `bash -c "..."`, `sh -c "..."` wrappers so commands run natively on Windows without invoking WSL
  const bashMatch = cleaned.match(
    /^(?:bash|sh)\s+-[a-zA-Z]+\s+["']([\s\S]*)["']$/,
  );
  if (bashMatch) {
    cleaned = bashMatch[1].trim();
  }

  return cleaned;
}

// Simple helper function to use login shell on Unix/macOS and PowerShell/CMD on Windows
function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // If the command contains && or ||, Windows PowerShell 5.1 throws:
    // "The token '&&' is not a valid statement separator in this version."
    // cmd.exe /d /s /c natively handles &&, ||, |, and all Windows commands.
    if (command.includes("&&") || command.includes("||")) {
      return {
        shell: "cmd.exe",
        args: ["/d", "/s", "/c", command],
      };
    }
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
    };
  } else {
    // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
    const userShell = process.env.SHELL || "/bin/bash";
    return { shell: userShell, args: ["-l", "-c", command] };
  }
}

import { fileURLToPath } from "node:url";
import { ToolImpl } from ".";
import {
  isProcessBackgrounded,
  markProcessAsRunning,
  removeBackgroundedProcess,
  removeRunningProcess,
  updateProcessOutput,
} from "../../util/processTerminalStates";
import { getBooleanArg, getStringArg } from "../parseArgs";

/**
 * Resolves the working directory from workspace dirs.
 * Falls back to home directory or temp directory if no workspace is available.
 */
function resolveWorkingDirectory(workspaceDirs: string[]): string {
  // Handle file:// URIs (local workspaces)
  const fileWorkspaceDir = workspaceDirs.find((dir) =>
    dir.startsWith("file:/"),
  );
  if (fileWorkspaceDir) {
    try {
      return fileURLToPath(fileWorkspaceDir);
    } catch {
      // fileURLToPath can fail on malformed URIs or in some remote environments
      // Fall through to default handling
    }
  }

  // Handle other URI schemes (vscode-remote://wsl, vscode-remote://ssh-remote, etc.)
  const remoteWorkspaceDir = workspaceDirs.find(
    (dir) => dir.includes("://") && !dir.startsWith("file:/"),
  );
  if (remoteWorkspaceDir) {
    try {
      const url = new URL(remoteWorkspaceDir);
      return decodeURIComponent(url.pathname);
    } catch {
      // Fall through to other handlers
    }
  }

  // Default to user's home directory with fallbacks
  try {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  } catch {
    // Final fallback if even process.cwd() fails - use system temp directory
    return os.tmpdir();
  }
}

// Add color-supporting environment variables
const getColorEnv = () => ({
  ...process.env,
  FORCE_COLOR: "1",
  COLORTERM: "truecolor",
  TERM: "xterm-256color",
  CLICOLOR: "1",
  CLICOLOR_FORCE: "1",
});

// Only spawn processes locally when there is no remote workspace.
// With extensionKind: ["ui", "workspace"], the extension host almost always
// runs on the local machine. childProcess.spawn() executes on the extension
// host, so for any remote workspace it would run commands on the wrong machine
// (or fail with ENOENT when the local shell doesn't match the remote OS).
// All remote types delegate to ide.runCommand() which routes through VS Code's
// integrated terminal and executes in the correct remote environment.
const LOCAL_ONLY = ["", "local"];

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  let command = getStringArg(args, "command");
  command = sanitizeWindowsCommand(command);
  // Default to waiting for completion if not specified
  const waitForCompletion =
    getBooleanArg(args, "waitForCompletion", false) ?? true;

  const toolCallId = extras.toolCallId || "";

  // Execute directly in the editor integrated terminal so it shows live in the user's terminal
  if (extras.ide?.runCommand) {
    const isDevServerCommand =
      /npm\s+(run\s+)?(dev|start)|vite|serve|python.*http\.server/i.test(command);

    await extras.ide.runCommand(command, {
      reuseTerminal: !isDevServerCommand,
      terminalName: isDevServerCommand ? "Codemind Server" : "Codemind",
    });

    if (!waitForCompletion) {
      await new Promise((r) => setTimeout(r, 1000));
      const initialOutput = (await extras.ide.getTerminalContents()) || "";
      const status = "Command is running in the background in editor terminal...";
      if (extras.onPartialOutput) {
        extras.onPartialOutput({
          toolCallId,
          contextItems: [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: initialOutput || "Command started in editor terminal",
              status: status,
            },
          ],
        });
      }
      return [
        {
          name: "Terminal",
          description: "Terminal command output",
          content: initialOutput || "Command started in editor terminal",
          status: status,
        },
      ];
    }

    // Wait and read output from the editor terminal
    let terminalOutput = "";
    const startTime = Date.now();
    const maxWaitMs = 60_000;
    let stableCount = 0;
    let lastLength = 0;

    await new Promise((r) => setTimeout(r, 1200));

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const currentContents = await extras.ide.getTerminalContents();
        if (currentContents) {
          terminalOutput = currentContents;
          if (extras.onPartialOutput) {
            extras.onPartialOutput({
              toolCallId,
              contextItems: [
                {
                  name: "Terminal",
                  description: "Terminal command output",
                  content: terminalOutput,
                  status: "Command running in editor terminal...",
                },
              ],
            });
          }

          // Check if dev server is detected ONLY for dev server commands!
          if (
            isDevServerCommand &&
            /http:\/\/(localhost|127\.0\.0\.1):\d+/i.test(terminalOutput)
          ) {
            return [
              {
                name: "Terminal",
                description: "Terminal command output",
                content: terminalOutput,
                status: "Dev server is running in editor terminal",
              },
            ];
          }

          // Check if output stabilized
          if (terminalOutput.length > 0 && terminalOutput.length === lastLength) {
            stableCount++;
            if (stableCount >= 2) {
              break;
            }
          } else {
            stableCount = 0;
            lastLength = terminalOutput.length;
          }
        }
      } catch {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return [
      {
        name: "Terminal",
        description: "Terminal command output",
        content: terminalOutput || "Command executed in editor terminal",
        status: "Command completed in editor terminal",
      },
    ];
  }

  const ideInfo = await extras.ide.getIdeInfo();

  if (LOCAL_ONLY.includes(ideInfo.remoteName)) {
    // For streaming output
    if (extras.onPartialOutput) {
      try {
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        const cwd = resolveWorkingDirectory(workspaceDirs);

        return new Promise((resolve, reject) => {
          let terminalOutput = "";
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          let sigkillTimeoutId: ReturnType<typeof setTimeout> | undefined;
          let hasResolved = false;
          let hasServerDetected = false;

          const safeResolve = (val: any) => {
            if (hasResolved) return;
            hasResolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (sigkillTimeoutId) clearTimeout(sigkillTimeoutId);
            resolve(val);
          };

          if (!waitForCompletion) {
            const status = "Command is running in the background...";
            if (extras.onPartialOutput) {
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: "",
                    status: status,
                  },
                ],
              });
            }
          }

          // Use spawn with color environment and ignored stdin to prevent hanging on interactive prompts
          const { shell, args } = getShellCommand(command);
          const childProc = childProcess.spawn(shell, args, {
            cwd,
            env: getColorEnv(), // Add enhanced environment for colors
            stdio: ["ignore", "pipe", "pipe"],
          });

          // Track this process for foreground cancellation
          if (toolCallId && waitForCompletion) {
            markProcessAsRunning(
              toolCallId,
              childProc,
              extras.onPartialOutput,
              terminalOutput,
            );
          }

          // Check if the child process is still running.
          // `childProc.killed` only indicates that kill() was called,
          // not that the process has actually exited.
          const isRunning = () =>
            childProc.exitCode === null && childProc.signalCode === null;

          // Set up timeout for waitForCompletion mode
          if (waitForCompletion) {
            timeoutId = setTimeout(() => {
              if (isRunning()) {
                terminalOutput +=
                  "\n[Timeout: process killed after 2 minutes]\n";

                // Update UI with timeout message
                if (extras.onPartialOutput) {
                  extras.onPartialOutput({
                    toolCallId,
                    contextItems: [
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: "Command timed out",
                      },
                    ],
                  });
                }

                // Try graceful termination first
                childProc.kill("SIGTERM");

                // Force kill after 5 seconds if still running
                sigkillTimeoutId = setTimeout(() => {
                  if (isRunning()) {
                    childProc.kill("SIGKILL");
                  }
                }, 5_000);
              }
            }, DEFAULT_TOOL_TIMEOUT_MS);
          }

          childProc.stdout?.on("data", (data) => {
            // Skip if this process has been backgrounded
            if (isProcessBackgrounded(toolCallId)) return;

            const newOutput = getDecodedOutput(data);
            terminalOutput += newOutput;

            // Auto-detect dev servers (e.g. Vite, Next.js, Webpack, etc.)
            // If output prints a localhost URL, resolve as a background server after 1.5s
            if (waitForCompletion && !hasServerDetected) {
              const urlMatch = terminalOutput.match(
                /(?:https?:\/\/localhost:\d+|https?:\/\/127\.0\.0\.1:\d+|Local:\s+https?:\/\/[^\s]+)/i,
              );
              if (urlMatch) {
                hasServerDetected = true;
                setTimeout(() => {
                  if (isRunning() && !hasResolved) {
                    safeResolve([
                      {
                        name: "Terminal",
                        description: "Terminal command output",
                        content: terminalOutput,
                        status: "Server is running in background",
                      },
                    ]);
                  }
                }, 1500);
              }
            }

            // Update the tracked output for potential cancellation notifications
            if (toolCallId && waitForCompletion) {
              updateProcessOutput(toolCallId, terminalOutput);
            }

            // Send partial output to UI
            if (extras.onPartialOutput) {
              const status = waitForCompletion
                ? ""
                : "Command is running in the background...";
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ],
              });
            }
          });

          childProc.stderr?.on("data", (data) => {
            // Skip if this process has been backgrounded
            if (isProcessBackgrounded(toolCallId)) return;

            const newOutput = getDecodedOutput(data);
            terminalOutput += newOutput;

            // Update the tracked output for potential cancellation notifications
            if (toolCallId && waitForCompletion) {
              updateProcessOutput(toolCallId, terminalOutput);
            }

            // Send partial output to UI, status is not required
            if (extras.onPartialOutput) {
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                  },
                ],
              });
            }
          });

          // If we don't need to wait for completion, resolve immediately
          if (!waitForCompletion) {
            const status = "Command is running in the background...";
            safeResolve([
              {
                name: "Terminal",
                description: "Terminal command output",
                content: terminalOutput,
                status: status,
              },
            ]);
          }

          childProc.on("close", (code) => {
            // Clear timeout on normal completion
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Clear inner SIGKILL timeout if process exits before grace period
            if (sigkillTimeoutId) {
              clearTimeout(sigkillTimeoutId);
            }

            // Clean up process tracking
            if (toolCallId) {
              if (isProcessBackgrounded(toolCallId)) {
                removeBackgroundedProcess(toolCallId);
                return;
              }
              // Remove from foreground tracking if it was tracked
              removeRunningProcess(toolCallId);
            }

            if (waitForCompletion) {
              // Normal completion, resolve now
              if (!code || code === 0) {
                const status = "Command completed";
                safeResolve([
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ]);
              } else {
                const status = `Command failed with exit code ${code}`;
                safeResolve([
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ]);
              }
            } else {
              // Already resolved, just update the UI with final output
              if (extras.onPartialOutput) {
                const status =
                  code === 0 || !code
                    ? "\nBackground command completed"
                    : `\nBackground command failed with exit code ${code}`;
                extras.onPartialOutput({
                  toolCallId,
                  contextItems: [
                    {
                      name: "Terminal",
                      description: "Terminal command output",
                      content: terminalOutput,
                      status: status,
                    },
                  ],
                });
              }
            }
          });

          childProc.on("error", (error) => {
            // Clear timeout on error
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Clear SIGKILL timeout to prevent delayed kill after rejection
            if (sigkillTimeoutId) {
              clearTimeout(sigkillTimeoutId);
            }

            // Clean up process tracking
            if (toolCallId) {
              if (isProcessBackgrounded(toolCallId)) {
                removeBackgroundedProcess(toolCallId);
                return;
              }
              // Remove from foreground tracking if it was tracked
              removeRunningProcess(toolCallId);
            }

            if (hasResolved) return;
            hasResolved = true;
            reject(error);
          });
        });
      } catch (error: any) {
        throw error;
      }
    } else {
      // Fallback to non-streaming for older clients
      const workspaceDirs = await extras.ide.getWorkspaceDirs();
      const cwd = resolveWorkingDirectory(workspaceDirs);

      if (waitForCompletion) {
        // Standard execution, waiting for completion
        try {
          // Use spawn approach for consistency with streaming version
          const { shell: nonStreamingShell, args: nonStreamingArgs } =
            getShellCommand(command);
          const output = await new Promise<{ stdout: string; stderr: string }>(
            (resolve, reject) => {
              let timeoutId: ReturnType<typeof setTimeout> | undefined;
              let sigkillTimeoutId: ReturnType<typeof setTimeout> | undefined;

              const childProc = childProcess.spawn(
                nonStreamingShell,
                nonStreamingArgs,
                {
                  cwd,
                  env: getColorEnv(),
                  stdio: ["ignore", "pipe", "pipe"],
                },
              );

              // Track this process for foreground cancellation
              if (toolCallId) {
                markProcessAsRunning(toolCallId, childProc, undefined, "");
              }

              let stdout = "";
              let stderr = "";

              // Check if the child process is still running.
              // `childProc.killed` only indicates that kill() was called,
              // not that the process has actually exited.
              const isRunning = () =>
                childProc.exitCode === null && childProc.signalCode === null;

              // Set up timeout
              timeoutId = setTimeout(() => {
                if (isRunning()) {
                  stderr += "\n[Timeout: process killed after 2 minutes]\n";

                  // Try graceful termination first
                  childProc.kill("SIGTERM");

                  // Force kill after 5 seconds if still running
                  sigkillTimeoutId = setTimeout(() => {
                    if (isRunning()) {
                      childProc.kill("SIGKILL");
                    }
                  }, 5_000);
                }
              }, DEFAULT_TOOL_TIMEOUT_MS);

              childProc.stdout?.on("data", (data) => {
                stdout += getDecodedOutput(data);
              });

              childProc.stderr?.on("data", (data) => {
                stderr += getDecodedOutput(data);
              });

              childProc.on("close", (code) => {
                // Clear outer timeout
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }

                // Clear inner SIGKILL timeout if process exits before grace period
                if (sigkillTimeoutId) {
                  clearTimeout(sigkillTimeoutId);
                }

                // Clean up process tracking
                if (toolCallId) {
                  removeRunningProcess(toolCallId);
                }

                if (code === 0) {
                  resolve({ stdout, stderr });
                } else {
                  const error = new ContinueError(
                    ContinueErrorReason.CommandExecutionFailed,
                    `Command failed with exit code ${code}`,
                  );
                  (error as any).stderr = stderr;
                  reject(error);
                }
              });

              childProc.on("error", (error) => {
                // Clear timeout on error
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }

                // Clear SIGKILL timeout to prevent delayed kill after rejection
                if (sigkillTimeoutId) {
                  clearTimeout(sigkillTimeoutId);
                }

                // Clean up process tracking
                if (toolCallId) {
                  removeRunningProcess(toolCallId);
                }
                reject(error);
              });
            },
          );

          const status = "Command completed";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: output.stdout ?? "",
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: error.stderr ?? error.toString(),
              status: status,
            },
          ];
        }
      } else {
        // For non-streaming but also not waiting for completion, use spawn
        // but don't attach any listeners other than error
        try {
          // Use spawn with color environment
          const { shell: detachedShell, args: detachedArgs } =
            getShellCommand(command);
          const childProc = childProcess.spawn(detachedShell, detachedArgs, {
            cwd,
            env: getColorEnv(), // Add color environment
            // Detach the process so it's not tied to the parent
            detached: true,
            // Redirect to /dev/null equivalent (works cross-platform)
            stdio: "ignore",
          });

          // Even for detached processes, add event handlers to clean up the background process map
          childProc.on("close", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          childProc.on("error", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          // Unref the child to allow the Node.js process to exit
          childProc.unref();
          const status = "Command is running in the background...";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        }
      }
    }
  }

  // For remote environments (SSH, WSL, Dev Container, Codespaces, etc.),
  // delegate to VS Code's integrated terminal which handles remote execution.
  // Note: output capture and waitForCompletion are not yet supported for remotes.
  await extras.ide.runCommand(command);
  return [
    {
      name: "Terminal",
      description: "Terminal command output",
      content:
        "Command executed in remote terminal. Output capture is not yet available for remote environments.",
      status: "Command executed",
    },
  ];
};
