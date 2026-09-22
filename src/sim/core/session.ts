/** Helpers tools use to read and update the learner's session. */
import { actorFor } from "../fs/accounts";
import type { FsContext } from "../fs/ops";
import type { Vfs } from "../fs/types";
import { hostById } from "../net/graph";
import type { DiscoveryState, Host } from "../net/types";
import type { FileChange, Machine, Session, SimEvent, SimState } from "./types";

/** The host the learner is on. Always exists: createInitialState and deserialize check it. */
export function sessionHost(state: SimState): Host {
  const host = hostById(state.network, state.session.hostId);
  if (!host) throw new Error(`state invariant: session host "${state.session.hostId}" is missing`);
  return host;
}

export function sessionMachine(state: SimState): Machine {
  const machine = Object.hasOwn(state.machines, state.session.hostId)
    ? state.machines[state.session.hostId]
    : undefined;
  if (!machine)
    throw new Error(`state invariant: session host "${state.session.hostId}" has no filesystem`);
  return machine;
}

/** Filesystem context for acting as the session's user, at the session's working directory. */
export function sessionFs(state: SimState, now: number): { vfs: Vfs; ctx: FsContext } {
  const machine = sessionMachine(state);
  const actor = actorFor(machine.accounts, state.session.user);
  if (!actor) throw new Error(`state invariant: session user "${state.session.user}" is missing`);
  return { vfs: machine.fs, ctx: { actor, cwd: state.session.cwd, now } };
}

/** A new state with the session machine's filesystem replaced. Everything else is shared. */
export function withSessionFs(state: SimState, fs: Vfs): SimState {
  const hostId = state.session.hostId;
  return {
    ...state,
    machines: { ...state.machines, [hostId]: { ...sessionMachine(state), fs } },
  };
}

export function withDiscovery(state: SimState, discovery: DiscoveryState): SimState {
  return discovery === state.discovery ? state : { ...state, discovery };
}

/** A new state with the session's fields changed. */
export function withSession(state: SimState, changes: Partial<Session>): SimState {
  return { ...state, session: { ...state.session, ...changes } };
}

/** A `file.changed` event on the session's host. */
export function fileChanged(state: SimState, path: string, change: FileChange): SimEvent {
  return { type: "file.changed", hostId: state.session.hostId, path, change };
}
