/**
 * The simulated network. Two separate structures, on purpose:
 *
 * - `NetworkGraph` is ground truth: every host, service and firewall rule in the scenario.
 * - `DiscoveryState` is what the learner has actually observed with their tools.
 *
 * The network visualizer (phase 07) renders only discovery state, which is what turns scanning
 * into a fog-of-war map.
 */
import type { FsSpec, GroupSpec, UserSpec } from "../fs/types";

export type Protocol = "tcp" | "udp";

export type OsFamily = "linux" | "windows" | "bsd" | "macos" | "embedded" | "other";

export interface OsProfile {
  readonly family: OsFamily;
  /** What a fingerprint would show, like "Linux" or "Embedded printer firmware". */
  readonly name: string;
  readonly version?: string;
}

export interface HttpPage {
  readonly status: number;
  readonly title?: string;
  /** Page source. HTML comments in it are shown by webprobe, like notes left in view-source. */
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** How a web service answers, for webprobe. */
export interface HttpProfile {
  /** Headers on every response, like "X-Powered-By". The Server header comes from product/version. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Pages by path ("/", "/admin"). Anything else is a 404. */
  readonly pages: Readonly<Record<string, HttpPage>>;
}

export interface Service {
  readonly port: number;
  readonly protocol: Protocol;
  /** The common name for what runs here: "ssh", "http", "https", "sql", "printer". */
  readonly name: string;
  /** Fictional or generic product name, like "httpd". Never a byte-copy of a real banner. */
  readonly product: string;
  readonly version: string;
  /** A greeting line some services send first. */
  readonly banner?: string;
  /**
   * Optional per-port firewall rule; same grammar as `Host.reachableFrom`. When set, it replaces
   * the host's rule for this port ("the database only accepts the web server").
   */
  readonly reachableFrom?: readonly string[];
  readonly http?: HttpProfile;
}

export interface NetworkInterface {
  readonly ip: string;
  /** The subnet this address belongs to, in CIDR form: "10.0.1.0/24". */
  readonly subnet: string;
}

export interface Host {
  readonly id: string;
  readonly hostname: string;
  readonly interfaces: readonly NetworkInterface[];
  readonly os: OsProfile;
  /** Sorted by port, then protocol. */
  readonly services: readonly Service[];
  /**
   * Who can reach this host: "*" (anyone), a host id ("web-01"), or a subnet ("10.0.1.0/24").
   * Reachability is explicit data, not a physics simulation, which is what makes firewalls and
   * segmentation teachable: a scenario states the rule and the engine enforces it.
   */
  readonly reachableFrom: readonly string[];
  /** Hosts that ignore "are you there?" pings only show up in scans that skip the ping. */
  readonly respondsToPing: boolean;
}

export interface Subnet {
  readonly cidr: string;
  readonly name?: string;
}

export interface NetworkGraph {
  /** Sorted by address. */
  readonly subnets: readonly Subnet[];
  readonly hosts: Readonly<Record<string, Host>>;
}

// ---------------------------------------------------------------------------------------------
// What the learner has observed
// ---------------------------------------------------------------------------------------------

export interface DiscoveredService {
  readonly port: number;
  readonly protocol: Protocol;
  /** The service name as the tool guessed it. */
  readonly name: string;
  /** Known only after fingerprinting (webprobe). */
  readonly product?: string;
  readonly version?: string;
  readonly banner?: string;
  /** The command number that first revealed it. */
  readonly firstSeenTick: number;
  /** The tool that first revealed it. */
  readonly via: string;
}

export interface DiscoveredHost {
  readonly hostId: string;
  /** Addresses the learner has seen this host answer on, sorted. */
  readonly ips: readonly string[];
  readonly hostname?: string;
  readonly osGuess?: string;
  readonly firstSeenTick: number;
  /** Where the learner first heard of it: a tool name, "session", or "briefing". Never updated. */
  readonly via: string;
  /**
   * It has answered one of the learner's tools (or it's their own machine). False for a host known
   * only from the briefing, which the map shows as "unknown" until it answers. `via` can't tell
   * the two apart, because it keeps the first source.
   */
  readonly answered: boolean;
  /** A port scan has run against it: "detected" vs "enumerated" on the map. */
  readonly portScanned: boolean;
  /** The learner has a session on it: the "accessed" state on the map. */
  readonly accessed: boolean;
  /** Keyed "port/protocol", like "22/tcp". */
  readonly services: Readonly<Record<string, DiscoveredService>>;
}

export interface DiscoveryState {
  readonly hosts: Readonly<Record<string, DiscoveredHost>>;
}

// ---------------------------------------------------------------------------------------------
// The network map's view of discovery state (selectTopology in net/discovery.ts)
// ---------------------------------------------------------------------------------------------

/**
 * How much the learner knows about a host, one step per look on the map:
 *
 * - `unknown`: they know it exists (from the briefing), but haven't seen it answer.
 * - `detected`: it answered a tool, so it's switched on and the learner can reach it.
 * - `enumerated`: its ports have been checked, or at least one service on it is known.
 * - `accessed`: the learner has a session on it.
 */
export type TopologyNodeState = "unknown" | "detected" | "enumerated" | "accessed";

/** One host on the map. Every field comes from discovery state, never from ground truth. */
export interface TopologyNode {
  readonly hostId: string;
  /** What the map calls it: the first label of its name ("web-01"), or its first seen address. */
  readonly label: string;
  /** Only once the learner has seen the name. */
  readonly hostname?: string;
  /** Addresses the learner has seen, sorted. Never empty. */
  readonly ips: readonly string[];
  /**
   * The subnets (CIDR) holding those addresses, in address order, without repeats. The first is
   * where the map places the host; each other one gets an `interface` link.
   */
  readonly subnets: readonly string[];
  readonly state: TopologyNodeState;
  /** Only once a scan has guessed it. */
  readonly osGuess?: string;
  /** Services the learner has seen, sorted by port, then protocol. */
  readonly services: readonly DiscoveredService[];
  readonly firstSeenTick: number;
  readonly via: string;
  /** The learner's own machine: "You are here". */
  readonly isSessionHost: boolean;
}

/** A network on the map. Only subnets holding an address the learner has seen are listed. */
export interface TopologySubnet {
  readonly cidr: string;
  /** The scenario's name for it, like "office". Known because the learner has an address in it. */
  readonly name?: string;
  /**
   * Hosts placed in this subnet, sorted by address: those whose first seen address is in it. A
   * multi-homed host is placed once; its other subnets get an `interface` link instead.
   */
  readonly hostIds: readonly string[];
  /** One of the learner's own machine's seen addresses is in it. */
  readonly containsSessionHost: boolean;
}

/**
 * - `route`: the learner's network reached a host that answered in another network (subnet CIDRs,
 *   from the subnet the learner's machine is placed in). Traffic between networks crosses a
 *   firewall, which is what the map's dashed boundaries mean.
 * - `interface`: a host the learner has seen on more than one network: one link per extra subnet.
 */
export type TopologyLink =
  | { readonly kind: "route"; readonly from: string; readonly to: string }
  | { readonly kind: "interface"; readonly hostId: string; readonly subnet: string };

export interface DiscoveredTopology {
  /** Sorted by first seen address, then host id. */
  readonly nodes: readonly TopologyNode[];
  /** Sorted by network address, then prefix length. */
  readonly subnets: readonly TopologySubnet[];
  /** Routes first (sorted by target subnet), then interfaces (in node order). */
  readonly links: readonly TopologyLink[];
  readonly sessionHostId: string;
  /**
   * What's on the map so far. Deliberately nothing about what's left to find: a count of what
   * remains would leak ground truth.
   */
  readonly counts: {
    /** Every host on the map, the learner's own machine and hosts only heard of included. */
    readonly hosts: number;
    /** Hosts other than the learner's own that have answered: "3 hosts found". */
    readonly found: number;
    /** Services seen, across every host. */
    readonly services: number;
    readonly byState: Readonly<Record<TopologyNodeState, number>>;
  };
}

// ---------------------------------------------------------------------------------------------
// Declarative specs, written in mission content and turned into a NetworkGraph by net/build.ts
// ---------------------------------------------------------------------------------------------

export interface HostSpec {
  readonly id: string;
  /** Fictional: a single label ("web-01") or a reserved domain ("web-01.corp.example"). */
  readonly hostname: string;
  /** Addresses must be in reserved ranges (10.x, 172.16-31.x, 192.168.x, documentation ranges). */
  readonly interfaces: readonly NetworkInterface[];
  readonly os: OsProfile;
  readonly services?: readonly Service[];
  /** Defaults to the host's own subnets: machines on the same network can reach each other. */
  readonly reachableFrom?: readonly string[];
  /** Defaults to true. */
  readonly respondsToPing?: boolean;
  /** Give a host a filesystem to make it a machine the learner can have a shell on. */
  readonly fs?: FsSpec;
  readonly users?: readonly UserSpec[];
  readonly groups?: readonly GroupSpec[];
}

export interface NetworkSpec {
  /** Names for subnets. Subnets used by interfaces but not listed here are added unnamed. */
  readonly subnets?: readonly Subnet[];
  readonly hosts: readonly HostSpec[];
}
