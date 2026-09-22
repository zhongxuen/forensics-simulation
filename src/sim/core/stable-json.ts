/**
 * JSON with object keys sorted, so the same value always serializes to the same bytes, whatever
 * order its keys were created in. Properties whose value is `undefined` are left out, like
 * JSON.stringify does.
 */
export function stableStringify(value: unknown, indent = 0): string {
  return write(value, indent, "");
}

function write(value: unknown, indent: number, pad: string): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError(`stableStringify: ${value} can't be represented in JSON`);
    }
    if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
      throw new TypeError(`stableStringify: a ${typeof value} can't be represented in JSON`);
    }
    return JSON.stringify(value ?? null);
  }
  const inner = indent > 0 ? pad + " ".repeat(indent) : "";
  const open = indent > 0 ? `\n${inner}` : "";
  const close = indent > 0 ? `\n${pad}` : "";
  const separator = indent > 0 ? `,\n${inner}` : ",";
  const colon = indent > 0 ? ": " : ":";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => (item === undefined ? "null" : write(item, indent, inner)));
    return `[${open}${items.join(separator)}${close}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (keys.length === 0) return "{}";
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}${colon}${write(record[key], indent, inner)}`,
  );
  return `{${open}${entries.join(separator)}${close}}`;
}
