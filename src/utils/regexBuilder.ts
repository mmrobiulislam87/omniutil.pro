export type RegexMatch = {
  index: number;
  end: number;
  groups: (string | undefined)[];
  namedGroups: Record<string, string | undefined>;
};

export type RegexTestResult = {
  valid: boolean;
  error?: string;
  flags: string;
  matches: RegexMatch[];
  matchCount: number;
  source: string;
};

export type RegexFlag = "g" | "i" | "m" | "s" | "u";

export function testRegex(
  pattern: string,
  testString: string,
  flags: RegexFlag[],
): RegexTestResult {
  if (!pattern) {
    return {
      valid: true,
      flags: flags.join(""),
      matches: [],
      matchCount: 0,
      source: pattern,
    };
  }

  const flagStr = flags.join("");

  try {
    const regex = new RegExp(pattern, flagStr.includes("g") ? flagStr : flagStr + "g");
    const matches: RegexMatch[] = [];
    let m: RegExpExecArray | null;

    while ((m = regex.exec(testString)) !== null) {
      matches.push({
        index: m.index,
        end: m.index + m[0].length,
        groups: m.slice(1),
        namedGroups: m.groups ?? {},
      });
      if (m[0].length === 0) regex.lastIndex++;
      if (!flagStr.includes("g")) break;
    }

    return {
      valid: true,
      flags: flagStr,
      matches,
      matchCount: matches.length,
      source: pattern,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid regular expression.",
      flags: flagStr,
      matches: [],
      matchCount: 0,
      source: pattern,
    };
  }
}

export function highlightMatches(
  text: string,
  matches: RegexMatch[],
): { before: string; match: string; after: string; key: string }[] {
  if (matches.length === 0) {
    return [{ before: text, match: "", after: "", key: "0" }];
  }

  const segments: { before: string; match: string; after: string; key: string }[] =
    [];
  let cursor = 0;

  matches.forEach((m, i) => {
    if (m.index > cursor) {
      segments.push({
        before: text.slice(cursor, m.index),
        match: "",
        after: "",
        key: `gap-${i}`,
      });
    }
    segments.push({
      before: "",
      match: text.slice(m.index, m.end),
      after: "",
      key: `match-${i}`,
    });
    cursor = m.end;
  });

  if (cursor < text.length) {
    segments.push({
      before: text.slice(cursor),
      match: "",
      after: "",
      key: "tail",
    });
  }

  return segments;
}
