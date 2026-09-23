import { describe, expect, it } from "vitest";
import { decodeBase64 } from "../../base64";
import { at, play, recordAt } from "../__fixtures__/case";

const BORN = at("2026-04-11T08:20:14Z");
const EDITED = at("2026-04-11T14:05:00Z");
const PATH = "C:\\Users\\dana\\Documents\\notes.txt";

const write = {
  at: BORN,
  actor: { kind: "user", account: "dana" } as const,
  on: "qf-lt-07",
  do: "create-file" as const,
  path: PATH,
  content: "one\n",
};

describe("modify-file", () => {
  it("moves the modified time but leaves the born time where it was", () => {
    const { evidence } = play([
      write,
      {
        at: EDITED,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "modify-file",
        path: PATH,
        content: "one\ntwo\n",
      },
    ]);

    const file = recordAt(evidence, PATH);
    expect(file.times.b).toBe(BORN);
    expect(file.times.m).toBe(EDITED);
    expect(file.times.c).toBe(EDITED);
    expect(new TextDecoder().decode(decodeBase64(file.contentB64))).toBe("one\ntwo\n");
  });

  it("adds to the end with append", () => {
    const { evidence } = play([
      write,
      {
        at: EDITED,
        actor: { kind: "user", account: "dana" },
        on: "qf-lt-07",
        do: "modify-file",
        path: PATH,
        append: "two\n",
      },
    ]);
    expect(new TextDecoder().decode(decodeBase64(recordAt(evidence, PATH).contentB64))).toBe(
      "one\ntwo\n",
    );
  });

  it("refuses content and append together, and a file that isn't there", () => {
    expect(() =>
      play([
        write,
        {
          at: EDITED,
          actor: { kind: "user", account: "dana" },
          on: "qf-lt-07",
          do: "modify-file",
          path: PATH,
          content: "a",
          append: "b",
        },
      ]),
    ).toThrow(/content to replace what the file says, or append/);

    expect(() =>
      play([
        {
          at: EDITED,
          actor: { kind: "user", account: "dana" },
          on: "qf-lt-07",
          do: "modify-file",
          path: "C:\\Users\\dana\\Documents\\nothing.txt",
          content: "a",
        },
      ]),
    ).toThrow(/no file at C:\\Users\\dana\\Documents\\nothing.txt/);
  });
});
