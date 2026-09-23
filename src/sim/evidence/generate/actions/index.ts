import type { ActionOf, StoryAction, StoryActionKind } from "../types";
import type { ActionContext } from "../world";
import { applyAddToGroup } from "./add-to-group";
import { applyBrowse } from "./browse";
import { applyCaptureMemory } from "./capture-memory";
import { applyClockSkew } from "./clock-skew";
import { applyConnect } from "./connect";
import { applyCopyToUsb } from "./copy-to-usb";
import { applyCreateAccount } from "./create-account";
import { applyCreateFile } from "./create-file";
import { applyDeleteFile } from "./delete-file";
import { applyDnsQuery } from "./dns-query";
import { applyDownload } from "./download";
import { applyFailedLogon } from "./failed-logon";
import { applyFirewallAllow } from "./firewall-allow";
import { applyFirewallBlock } from "./firewall-block";
import { applyHandOver } from "./hand-over";
import { applyInject } from "./inject";
import { applyLogoff } from "./logoff";
import { applyLogon } from "./logon";
import { applyModifyFile } from "./modify-file";
import { applyOverwriteClusters } from "./overwrite-clusters";
import { applyReadFile } from "./read-file";
import { applyRunProcess } from "./run-process";
import { applyUsbInsert } from "./usb-insert";
import { applyWebRequest } from "./web-request";

/**
 * The story vocabulary (docs/plan/03-case-format-and-generator.md §Story actions): everything a
 * case can say happened. One action, one file, one test. Each one changes the machine's state
 * **and** leaves every artefact it really would — a file's times, a log record, a process in
 * memory — so the evidence can never disagree with the story that made it.
 *
 * Adding an action is a new file here plus one line in `ACTIONS`, one branch in the story schema
 * (`src/content/cases/schema.ts`) and one case in `StoryAction` (`../types.ts`). The type of
 * `ACTIONS` requires a handler for every kind, so a new one can't be half-added.
 */
type Handlers = {
  readonly [K in StoryActionKind]: (ctx: ActionContext, action: ActionOf<K>) => void;
};

export const ACTIONS: Handlers = {
  logon: applyLogon,
  logoff: applyLogoff,
  "failed-logon": applyFailedLogon,
  "create-account": applyCreateAccount,
  "add-to-group": applyAddToGroup,
  "create-file": applyCreateFile,
  "modify-file": applyModifyFile,
  "read-file": applyReadFile,
  "delete-file": applyDeleteFile,
  "overwrite-clusters": applyOverwriteClusters,
  "usb-insert": applyUsbInsert,
  "copy-to-usb": applyCopyToUsb,
  browse: applyBrowse,
  download: applyDownload,
  "run-process": applyRunProcess,
  inject: applyInject,
  connect: applyConnect,
  "firewall-allow": applyFirewallAllow,
  "firewall-block": applyFirewallBlock,
  "dns-query": applyDnsQuery,
  "web-request": applyWebRequest,
  "clock-skew": applyClockSkew,
  "capture-memory": applyCaptureMemory,
  "hand-over": applyHandOver,
};

/** Every `do:` value a story can use, sorted, for error messages and the authoring scripts. */
export const ACTION_KINDS: readonly StoryActionKind[] = (
  Object.keys(ACTIONS) as StoryActionKind[]
).sort();

/** Plays one action. The registry is keyed by `do:`, so the union picks the handler. */
export function applyAction(ctx: ActionContext, action: StoryAction): void {
  // One cast, in one place: the registry's type has already proved each handler takes the action
  // its own key selects, which TypeScript can't follow through a lookup on a union.
  const handler = ACTIONS[action.do] as (ctx: ActionContext, action: StoryAction) => void;
  handler(ctx, action);
}
