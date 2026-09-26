import {
  CONTRAST_AUDIT_EXCLUSIONS,
  formatContrastRatio,
  type ContrastAuditGroup,
  type ContrastAuditRow,
  type ContrastTheme,
} from "@/lib/contrast-audit";
import { cx } from "@/lib/cx";
import { Code, Section } from "./styleguide-ui";

const tokenVar = (name: string) => `var(--${name})`;

export interface ThemeAudit {
  readonly theme: ContrastTheme;
  readonly groups: readonly ContrastAuditGroup[];
}

export function ContrastSection({ id, audits }: { id: string; audits: readonly ThemeAudit[] }) {
  const rows = audits.flatMap((audit) => audit.groups.flatMap((group) => group.rows));
  const failures = rows.filter((row) => !row.passes).length;

  return (
    <Section
      id={id}
      title="Contrast audit"
      intro={
        <p>
          Every colour pair the design uses, measured with <Code>src/lib/contrast.ts</Code> from the
          values in <Code>src/styles/tokens.css</Code>, once per app theme. WCAG AA: text needs
          4.5:1 at any size; borders, focus rings and indicators need 3:1. Ratios are rounded down,
          never up. <Code>pnpm test</Code> fails if any pair here fails.
        </p>
      }
    >
      <p
        className={cx(
          "rounded-lg border px-4 py-3 font-semibold",
          failures === 0
            ? "border-status-success text-status-success"
            : "border-status-danger text-status-danger",
        )}
      >
        <span aria-hidden="true">{failures === 0 ? "✓ " : "✗ "}</span>
        {failures === 0
          ? `All ${rows.length} pairs pass WCAG AA.`
          : `${failures} of ${rows.length} pairs fail WCAG AA.`}
      </p>

      {audits.map(({ theme, groups }) => (
        // data-theme draws each theme's samples with that theme's live tokens.
        <div
          key={theme.id}
          data-theme={theme.id}
          className="mt-10 rounded-xl bg-surface-base p-4 text-primary sm:p-6"
        >
          <h3 className="text-xl font-semibold">{theme.title}</h3>
          <div className="mt-6 space-y-12">
            {groups.map((group) => (
              <AuditTable key={group.id} group={group} themeId={theme.id} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-12">
        <h3 className="text-lg font-semibold">Not measured as foregrounds</h3>
        <dl className="mt-3 space-y-3 text-sm leading-6">
          {Object.entries(CONTRAST_AUDIT_EXCLUSIONS).map(([name, reason]) => (
            <div key={name}>
              <dt>
                <Code>--{name}</Code>
              </dt>
              <dd className="mt-1 text-secondary">{reason}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

function AuditTable({ group, themeId }: { group: ContrastAuditGroup; themeId: string }) {
  const failures = group.rows.filter((row) => !row.passes).length;
  const headingId = `contrast-${themeId}-${group.id}`;

  return (
    <div>
      <h4 id={headingId} className="text-lg font-semibold">
        {group.title}
      </h4>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-secondary">{group.description}</p>
      <p className="mt-1 text-sm text-muted">
        {group.rows.length} pairs, {failures === 0 ? "all pass" : `${failures} fail`}. Minimum{" "}
        {group.rows[0]?.minimum ?? "?"}:1.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-subtle">
        <table aria-labelledby={headingId} className="w-full min-w-176 text-left text-sm">
          <thead className="bg-surface-raised text-secondary">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Sample
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Foreground
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Background
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Ratio
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {group.rows.map((row) => (
              <tr key={`${row.foreground} on ${row.background}`}>
                <td className="px-4 py-2.5">
                  <Sample row={row} use={group.use} />
                </td>
                <td className="px-4 py-2.5">
                  <Token name={row.foreground} value={row.foregroundValue} />
                </td>
                <td className="px-4 py-2.5">
                  <Token name={row.background} value={row.backgroundValue} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {row.ratio === undefined ? "—" : `${formatContrastRatio(row.ratio)}:1`}
                </td>
                <td className="px-4 py-2.5">
                  <Result row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The pair itself, drawn with the live tokens: text for text pairs, a border for the rest. */
function Sample({ row, use }: { row: ContrastAuditRow; use: ContrastAuditGroup["use"] }) {
  if (use === "text") {
    return (
      <span
        className="inline-block rounded-md border border-subtle px-3 py-1.5 font-medium whitespace-nowrap"
        style={{ color: tokenVar(row.foreground), backgroundColor: tokenVar(row.background) }}
      >
        Sample text
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex rounded-md border border-subtle p-2"
      style={{ backgroundColor: tokenVar(row.background) }}
    >
      <span
        className="block h-5 w-16 rounded-sm border-2"
        style={{ borderColor: tokenVar(row.foreground) }}
      />
    </span>
  );
}

function Token({ name, value }: { name: string; value: string | undefined }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-full border border-strong"
        style={{ backgroundColor: tokenVar(name) }}
      />
      <span>
        <Code>--{name}</Code>
        <span className="mt-0.5 block font-mono text-xs text-muted">{value ?? "missing"}</span>
      </span>
    </span>
  );
}

function Result({ row }: { row: ContrastAuditRow }) {
  return (
    <span
      className={cx("font-semibold", row.passes ? "text-status-success" : "text-status-danger")}
    >
      <span aria-hidden="true">{row.passes ? "✓ " : "✗ "}</span>
      {row.passes ? "PASS" : "FAIL"}
      {row.problem !== undefined && (
        <span className="mt-0.5 block text-xs font-normal">{row.problem}</span>
      )}
    </span>
  );
}
