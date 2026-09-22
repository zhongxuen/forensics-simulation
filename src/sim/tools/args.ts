/**
 * Option parsing for simulated tools: `-p 22`, `-p22`, `--ports 22`, `--ports=22`, boolean flags,
 * clusters of one-letter switches (`-la` is `-l -a`, and `-fn5` is `-f -n 5`), and `--` to end
 * options. Unknown options are a typed BAD_FLAG error, never ignored.
 */
import { err, ok, type Result } from "../core/result";
import type { SimError } from "../core/errors";

export interface OptionSpec {
  /** Every spelling: ["-p", "--ports"]. */
  readonly names: readonly string[];
  /** Where the value lands in `ParsedArgs.options`. */
  readonly key: string;
  /** Takes a value (`--ports 22`) rather than being a switch (`--no-ping`). */
  readonly takesValue?: boolean;
}

export interface ParsedArgs {
  /** Switches map to `true`, valued options to their (last) value. */
  readonly options: Readonly<Record<string, string | true>>;
  readonly positionals: readonly string[];
}

export function parseArgs(
  args: readonly string[],
  specs: readonly OptionSpec[],
): Result<ParsedArgs, SimError> {
  const lookup = new Map<string, OptionSpec>();
  for (const spec of specs) for (const name of spec.names) lookup.set(name, spec);

  const options: Record<string, string | true> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      positionals.push(arg);
      continue;
    }

    let name = arg;
    let inline: string | undefined;
    if (arg.startsWith("--") && arg.includes("=")) {
      name = arg.slice(0, arg.indexOf("="));
      inline = arg.slice(arg.indexOf("=") + 1);
    } else if (!arg.startsWith("--") && arg.length > 2 && lookup.get(arg.slice(0, 2))?.takesValue) {
      name = arg.slice(0, 2); // -p22
      inline = arg.slice(2);
    }

    const spec = lookup.get(name);
    if (!spec && inline === undefined && /^-[^-]{2,}$/.test(arg)) {
      // A cluster of one-letter options: every letter is a switch, until one that takes a value
      // swallows the rest of the cluster (or, at the end, the next argument).
      for (let j = 1; j < arg.length; j++) {
        const letter = lookup.get(`-${arg[j]}`);
        if (!letter) return err({ code: "BAD_FLAG", flag: `-${arg[j]}` });
        if (!letter.takesValue) {
          options[letter.key] = true;
          continue;
        }
        const rest = arg.slice(j + 1);
        const value = rest || args[i + 1];
        if (value === undefined) return err({ code: "MISSING_ARGUMENT", argument: `-${arg[j]}` });
        if (!rest) i++;
        options[letter.key] = value;
        break;
      }
      continue;
    }
    if (!spec) return err({ code: "BAD_FLAG", flag: name });
    if (!spec.takesValue) {
      if (inline !== undefined) return err({ code: "BAD_FLAG", flag: arg });
      options[spec.key] = true;
      continue;
    }
    const value = inline ?? args[i + 1];
    if (value === undefined || (inline === undefined && value.startsWith("-") && value !== "-")) {
      return err({ code: "MISSING_ARGUMENT", argument: name });
    }
    if (inline === undefined) i++;
    options[spec.key] = value;
  }
  return ok({ options, positionals });
}

/** The value of a valued option, or `undefined`. */
export function optionValue(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === "string" ? value : undefined;
}

export const hasSwitch = (parsed: ParsedArgs, key: string): boolean => parsed.options[key] === true;
