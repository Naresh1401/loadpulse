/**
 * Minimal dependency-free CLI flag parser.
 *
 * Supports `--flag value`, `--flag=value`, and repeated `--flag` entries
 * (collected into an array), which is enough for this project's CLIs
 * without pulling in an external argument-parsing library.
 */
export function parseArgs(argv: string[]): Record<string, string | string[] | boolean> {
  const result: Record<string, string | string[] | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const eqIndex = token.indexOf("=");
    let key: string;
    let value: string | boolean;

    if (eqIndex !== -1) {
      key = token.slice(2, eqIndex);
      value = token.slice(eqIndex + 1);
    } else {
      key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i += 1;
      } else {
        value = true;
      }
    }

    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(String(value));
    } else {
      result[key] = [String(existing), String(value)];
    }
  }

  return result;
}
