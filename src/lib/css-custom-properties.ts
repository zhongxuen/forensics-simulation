/**
 * Reads CSS custom property declarations (`--name: value;`) out of a stylesheet's source text, so
 * the /styleguide and the contrast test can measure the tokens in src/styles/tokens.css without a
 * second copy of the values.
 *
 * Not a general CSS parser. It handles comments, nested blocks, and a last declaration with no
 * semicolon, which covers our token files and Tailwind's theme.css. It does not understand strings
 * or url() values that contain braces or semicolons.
 */

export interface CustomProperty {
  /** Without the leading dashes: `text-primary` for `--text-primary`. */
  readonly name: string;
  /** The declared value, trimmed, with runs of whitespace collapsed. Never resolved. */
  readonly value: string;
  /** The prelude of the block it's declared in, such as `:root` or `@theme default`. */
  readonly block: string;
}

const DECLARATION = /^\s*--([\w-]+)\s*:\s*([\s\S]*?)\s*$/;

const collapseWhitespace = (text: string) => text.trim().replace(/\s+/g, " ");

/** Every custom property declaration in `css`, in source order. */
export function parseCustomProperties(css: string): CustomProperty[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: string[] = [];
  const found: CustomProperty[] = [];
  let buffer = "";

  const flushDeclaration = () => {
    const match = DECLARATION.exec(buffer);
    const [, name, value] = match ?? [];
    if (name !== undefined && value !== undefined) {
      found.push({ name, value: collapseWhitespace(value), block: blocks.at(-1) ?? "" });
    }
    buffer = "";
  };

  for (const char of source) {
    if (char === "{") {
      blocks.push(collapseWhitespace(buffer));
      buffer = "";
    } else if (char === "}") {
      flushDeclaration();
      blocks.pop();
    } else if (char === ";") {
      flushDeclaration();
    } else {
      buffer += char;
    }
  }

  return found;
}

/**
 * The custom properties declared directly in blocks whose prelude is exactly `block` (for example
 * `":root"`), keyed by name without the dashes. A later declaration of the same name wins, as it
 * would in the cascade.
 */
export function customPropertiesIn(css: string, block: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const property of parseCustomProperties(css)) {
    if (property.block === block) properties.set(property.name, property.value);
  }
  return properties;
}
