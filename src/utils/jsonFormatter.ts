export type JsonIndent = 2 | 4 | "minify";

export type JsonFormatResult =
  | { ok: true; output: string }
  | { ok: false; error: string };

function lineColumnAt(input: string, position: number): { line: number; column: number } {
  const before = input.slice(0, Math.max(0, position));
  const lines = before.split("\n");
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  return { line, column };
}

export function describeJsonError(input: string, err: unknown): string {
  if (!(err instanceof SyntaxError)) {
    return err instanceof Error ? err.message : "Invalid JSON syntax detected.";
  }

  const positionMatch = err.message.match(/position\s+(\d+)/i);
  if (positionMatch) {
    const { line, column } = lineColumnAt(input, Number(positionMatch[1]));
    return `Line ${line}, column ${column}: ${err.message}`;
  }

  return err.message;
}

export function formatJson(rawInput: string, indent: JsonIndent): JsonFormatResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: true, output: "" };
  }

  try {
    const parsed: unknown = JSON.parse(rawInput);
    const output =
      indent === "minify"
        ? JSON.stringify(parsed)
        : JSON.stringify(parsed, null, indent);
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: describeJsonError(rawInput, err) };
  }
}
