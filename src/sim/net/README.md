# src/sim/net

Virtual hosts, services, and the network graph. Reachability is explicit data (`reachableFrom` rules per host and per port), which is what makes firewalls teachable. Ground truth (`NetworkGraph`) and what the learner has observed (`DiscoveryState`) are separate structures; the network map renders discovery state only. Addresses come from reserved ranges only (`10.x`, `172.16.x`, `192.168.x`), and hostnames are single words or under reserved domains (`.example`, `.test`, `.internal`).

`selectTopology(state)` in `discovery.ts` is the network map's only data source: it turns discovery state into nodes (each in one of four states: `unknown` for a host only heard of in the briefing, `detected`, `enumerated`, `accessed`), subnets, and links. It never returns anything the learner hasn't seen, and never counts what's left to find; `topology.test.ts` proves that for hosts that exist but were never seen.

Never import here: `net`, `http`, `dns`, `fetch`, or anything that opens a real socket or resolves a real host.
