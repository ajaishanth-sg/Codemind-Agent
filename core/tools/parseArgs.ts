import { ToolCallDelta } from "..";

export function safeParseToolCallArgs(
  toolCall: ToolCallDelta,
): Record<string, any> {
  const args = toolCall.function?.arguments;

  if (
    args &&
    typeof args === "object" &&
    !Array.isArray(args) &&
    Object.keys(args).length > 0
  ) {
    return args;
  }

  const raw = typeof args === "string" ? args.trim() : "";
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    if (typeof parsed === "string") {
      return { command: parsed, filepath: parsed, contents: parsed };
    }
    if (Array.isArray(parsed)) {
      return { command: parsed.join(" ") };
    }
    return {};
  } catch (e) {
    // If not valid JSON, check for markdown code fence
    const codeBlockMatch = raw.match(/```(?:bash|sh|powershell|cmd|ps1)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return { command: codeBlockMatch[1].trim() };
    }
    // Plain string command
    return { command: raw };
  }
}

/**
 * Coerce parsed args to match the tool's input schema types.
 * JSON.parse() deeply parses all values, so string-typed parameters
 * that contain valid JSON (e.g. file content for a .json file) get
 * converted to objects. This checks the schema and re-stringifies
 * any values that should be strings.
 */
export function coerceArgsToSchema(
  args: Record<string, any>,
  schema?: Record<string, any>,
): Record<string, any> {
  if (!schema?.properties) {
    return args;
  }

  const coerced = { ...args };
  for (const [key, value] of Object.entries(coerced)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      continue;
    }

    if (
      propSchema.type === "string" &&
      typeof value === "object" &&
      value !== null
    ) {
      try {
        coerced[key] = JSON.stringify(value);
      } catch {
        // leave as-is if stringify fails
      }
    }
  }

  return coerced;
}

export function getStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
): string {
  // If args is directly a string
  if (typeof args === "string" && (argName === "command" || argName === "filepath" || argName === "contents")) {
    if (!allowEmpty && !args.trim()) {
      throw new Error(`Argument ${argName} must not be empty or whitespace-only`);
    }
    return args.trim();
  }

  // If args is an array
  if (Array.isArray(args) && argName === "command") {
    const joined = args.join(" ").trim();
    if (joined) return joined;
  }

  let value: any;
  if (args && typeof args === "object") {
    value = args[argName];
    // Fallback aliases for command
    if (value === undefined && argName === "command") {
      value = args.cmd ?? args.command_line ?? args.script ?? args.input ?? args.code;
    }
    // Fallback aliases for filepath
    if (value === undefined && argName === "filepath") {
      value = args.path ?? args.file ?? args.filename;
    }
    // Fallback aliases for contents
    if (value === undefined && argName === "contents") {
      value = args.content ?? args.code ?? args.text;
    }
  }

  if (value === undefined) {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  // Handle case where JSON was parsed into an object by the tool call parser.
  // If the arguments to the tool call are valid JSON (e.g. the model attempts to create a .json file)
  // the earlier call to JSON.parse() will have deeply parsed the returned arguments.
  // If that has happened, convert back to string.
  if (typeof value === "object" && value !== null) {
    try {
      value = JSON.stringify(value);
      return value;
    } catch (e) {
      //Swallow this, because it might be fine later.
    }
  }

  if (typeof value !== "string") {
    throw new Error(
      `\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty or whitespace-only"}. (type string)`,
    );
  }

  if (!allowEmpty && !value.trim()) {
    throw new Error(`Argument ${argName} must not be empty or whitespace-only`);
  }

  return value;
}

export function getOptionalStringArg(
  args: any,
  argName: string,
  allowEmpty = false,
) {
  if (typeof args?.[argName] === "undefined") {
    return undefined;
  }
  return getStringArg(args, argName, allowEmpty);
}

export function getNumberArg(args: any, argName: string): number {
  if (!args || !(argName in args)) {
    throw new Error(`Argument \`${argName}\` is required (type number)`);
  }
  const value = args[argName];
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Argument \`${argName}\` must be a valid number`);
    }
    return parsed;
  }
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`Argument \`${argName}\` must be a valid number`);
  }
  return Math.floor(value); // Ensure integer for line numbers (supports negative numbers)
}

export function getBooleanArg(args: any, argName: string, required = false) {
  if (!args || !(argName in args)) {
    if (required) {
      throw new Error(`Argument \`${argName}\` is required (type boolean)`);
    } else {
      return undefined;
    }
  }
  if (typeof args[argName] === "string") {
    if (args[argName].toLowerCase() === "false") {
      return false;
    }
    if (args[argName].toLowerCase() === "true") {
      return true;
    }
  }
  if (typeof args[argName] !== "boolean") {
    throw new Error(`Argument \`${argName}\` must be a boolean true or false`);
  }
  return args[argName];
}
