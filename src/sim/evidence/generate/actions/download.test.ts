import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, oneLog, play, recordAt } from "../__fixtures__/case";

const WHEN = at("2026-04-11T19:41:00Z");
const PATH = "C:\\Users\\Public\\Downloads\\dispatch-sync.exe";

describe("download", () => {
  it("looks the name up, then writes the file", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "download",
        url: "https://cdn-sync.example/tools/sync",
        path: PATH,
        content: "not really a program\n",
      },
    ]);

    expect(oneLog(evidence, "dns").fields.query).toBe("cdn-sync.example");
    const file = recordAt(evidence, PATH);
    expect(file.times.b).toBe(WHEN);
    expect(new TextDecoder().decode(decodeBase64(file.contentB64))).toBe("not really a program\n");
    expect(oneLog(evidence, "sysmon-lite", 11).fields.TargetFilename).toBe(PATH);
  });

  it("says where a file came from when the story doesn't give it content", () => {
    const { evidence } = play([
      {
        at: WHEN,
        actor: { kind: "attacker" },
        on: "qf-lt-07",
        do: "download",
        url: "https://cdn-sync.example/tools/sync",
        path: PATH,
      },
    ]);
    expect(new TextDecoder().decode(decodeBase64(recordAt(evidence, PATH).contentB64))).toContain(
      "cdn-sync.example",
    );
  });
});
