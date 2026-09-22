import { failure, stdout } from "../../core/output";
import { sessionHost, withDiscovery } from "../../core/session";
import type { OutputLine, SimEvent } from "../../core/types";
import { recordHost } from "../../net/discovery";
import { canReach, primaryIp } from "../../net/graph";
import { optionValue, parseArgs } from "../args";
import { resolveEndpoint } from "../target";
import type { Tool } from "../types";
import { extraArgument, usage, wholeNumber } from "./shared";

const NAME = "ping";
const MAX_COUNT = 20;

export const ping: Tool = {
  name: NAME,
  category: "network",
  help: {
    oneLiner: 'ask another computer "are you there?" and time how long it takes to answer.',
    usage: ["ping [-c count] address-or-name"],
    description: [
      'Every computer on a network has an address, its IP address, like 10.40.2.15. ping sends it a small "are you there?" message (also called a ping) and waits for the reply. Each reply line shows how long the round trip took, in milliseconds (thousandths of a second).',
      "On a real computer ping keeps going until you press Ctrl+C. Here it sends 4 pings and stops; -c chooses how many.",
      "No reply doesn't always mean nothing is there. The computer might be switched off, a firewall (a set of rules about who may talk to whom) might be blocking you, or it might be set to ignore pings. Some printers do.",
    ],
    options: [
      { flags: "-c <count>", text: `How many pings to send, up to ${MAX_COUNT}. Defaults to 4.` },
    ],
    examples: [
      { command: "ping 10.40.2.15", text: "Check whether the computer at 10.40.2.15 answers." },
      { command: "ping -c 1 orders-01", text: "Send one ping to the computer called orders-01." },
    ],
    concept: [
      "Ping is the simplest way to check a computer is reachable, and the first thing people try when the network seems broken. Security testers use it to see which computers are up, but on its own it can be fooled: that's why tools like netscan can also check ports on computers that stay quiet.",
      "Only ping computers you have permission to test. Here, the practice network is yours to explore.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-c", "--count"], key: "count", takesValue: true }]);
    if (!parsed.ok) return usage(NAME, parsed.error, state);
    const [target, extra] = parsed.value.positionals;
    if (target === undefined)
      return usage(NAME, { code: "MISSING_ARGUMENT", argument: "destination address" }, state);
    if (extra !== undefined) return extraArgument(NAME, extra, state);
    const countText = optionValue(parsed.value, "count");
    const count = countText === undefined ? 4 : wholeNumber(countText, MAX_COUNT);
    if (count === undefined || count === 0) {
      return usage(
        NAME,
        { code: "BAD_ARGUMENT", argument: "count", value: countText ?? "", reason: "out-of-range" },
        state,
      );
    }

    const from = sessionHost(state);
    const loopback = target === "localhost" || /^127\.\d+\.\d+\.\d+$/.test(target);
    const endpoint = loopback
      ? {
          ok: true as const,
          value: { host: from, ip: target === "localhost" ? "127.0.0.1" : target, display: target },
        }
      : resolveEndpoint(state.network, target, undefined);
    if (!endpoint.ok) return failure(NAME, endpoint.error, state);
    const { host, ip, display } = endpoint.value;
    const answers =
      host.id === from.id || (canReach(state.network, from.id, host.id) && host.respondsToPing);

    const shownName = display === ip ? ip : `${display} (${ip})`;
    const output: OutputLine[] = [stdout(`PING ${shownName} 56(84) bytes of data.`)];
    const times: number[] = [];
    if (answers) {
      for (let seq = 1; seq <= count; seq++) {
        const ms = host.id === from.id ? 0.03 + ctx.rng.next() * 0.04 : 0.3 + ctx.rng.next() * 1.7;
        times.push(ms);
        output.push(
          stdout(
            `64 bytes from ${ip}: icmp_seq=${seq} ttl=64 time=${ms.toFixed(ms < 1 ? 3 : 2)} ms`,
          ),
        );
      }
    }
    const received = times.length;
    const loss = Math.round(((count - received) / count) * 100);
    const elapsed = Math.round(
      (count - 1) * 1000 + (received > 0 ? times.reduce((a, b) => a + b, 0) : 0),
    );
    output.push(stdout(""), stdout(`--- ${display} ping statistics ---`));

    const events: SimEvent[] = [];
    let next = state;
    if (received > 0) {
      output.push(
        stdout(
          `${count} packets transmitted, ${received} received, ${loss}% packet loss, time ${elapsed}ms`,
        ),
      );
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / received;
      output.push(
        stdout(`rtt min/avg/max = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)} ms`),
      );
      if (!loopback) {
        const seen = recordHost(state.discovery, {
          hostId: host.id,
          ip: host.id === from.id ? primaryIp(from) : ip,
          hostname: host.hostname,
          via: NAME,
          tick: ctx.tick,
        });
        next = withDiscovery(state, seen.discovery);
        if (seen.isNew) events.push({ type: "host.discovered", hostId: host.id, ip, via: NAME });
      }
      return { state: next, output, events, exitCode: 0 };
    }
    // No reply: the summary line carries the typed error, for the explainer layer.
    output.push({
      stream: "stdout",
      text: `${count} packets transmitted, 0 received, 100% packet loss, time ${elapsed}ms`,
      error: { code: "HOST_UNREACHABLE", target: display },
    });
    return { state, output, events, exitCode: 1 };
  },
};
