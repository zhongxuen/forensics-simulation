import { describe, expect, it } from "vitest";
import { at, play, recordAt } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const READ = at("2026-04-11T19:45:00Z");
const PATH = "C:\\Users\\dana\\Documents\\notes.txt";

describe("read-file", () => {
  it("moves only the accessed time", () => {
    const { evidence } = play([
      {
        at: BORN,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "create-file",
        path: PATH,
        content: "one\n",
      },
      { at: READ, actor: { kind: "attacker" }, on: "qf-lt-07", do: "read-file", path: PATH },
    ]);

    const file = recordAt(evidence, PATH);
    expect(file.times).toEqual({ m: BORN, a: READ, c: BORN, b: BORN });
  });
});
