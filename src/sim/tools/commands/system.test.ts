import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, text } from "../../__fixtures__/harness";
import { FIXTURE_SCENARIO } from "../../__fixtures__/scenario";
import { shell } from "../../__fixtures__/shell";
import { createInitialState } from "../../core/scenario";
import type { ScenarioSpec, SimState } from "../../core/types";

/** The fixture, with recruit also in the sudo group. */
function sudoerState(): SimState {
  const [ws, ...others] = FIXTURE_SCENARIO.network.hosts;
  const spec: ScenarioSpec = {
    ...FIXTURE_SCENARIO,
    network: {
      ...FIXTURE_SCENARIO.network,
      hosts: [
        {
          ...ws!,
          users: ws!.users!.map((user) =>
            user.name === "recruit" ? { ...user, groups: ["adm", "sudo"] } : user,
          ),
        },
        ...others,
      ],
    },
  };
  return createInitialState(spec, 1);
}

describe("whoami and id", () => {
  it("name the session's account and its groups", () => {
    expect(text(run(fixtureState(), "whoami"))).toBe("recruit");
    expect(text(run(fixtureState(), "id"))).toMatch(
      /^uid=1000\(recruit\) gid=1000\(recruit\) groups=1000\(recruit\),\d+\(adm\)$/,
    );
    expect(text(run(fixtureState(), "id", "root"))).toBe("uid=0(root) gid=0(root) groups=0(root)");
    expect(text(run(fixtureState(), "id", "-un"))).toBe("recruit");
    expect(text(run(fixtureState(), "id", "mallory"))).toBe("id: 'mallory': no such user");
  });
});

describe("ps", () => {
  it("shows this terminal's processes, or every process with aux", () => {
    expect(text(run(fixtureState(), "ps"))).toMatch(
      /PID\s+TTY\s+TIME\s+CMD\n\s+1042\s+pts\/0 .* -bash\n/,
    );
    const all = text(run(fixtureState(), "ps", "aux"));
    expect(all).toContain("/sbin/init");
    expect(all).toContain("/usr/sbin/sshd (port 22)");
    expect(text(run(fixtureState(), "ps", "-ef"))).toContain("UID");
  });
});

describe("uname, hostname and ifconfig", () => {
  it("describe the session's computer", () => {
    expect(text(run(fixtureState(), "uname"))).toBe("Linux");
    expect(text(run(fixtureState(), "uname", "-a"))).toBe(
      "Linux ws-01 6.8.0-sim #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
    );
    expect(text(run(fixtureState(), "hostname"))).toBe("ws-01");
    expect(text(run(fixtureState(), "hostname", "-f"))).toBe("ws-01.corp.example");
    expect(text(run(fixtureState(), "hostname", "-I")).trim()).toBe("10.0.1.10");
    expect(errorCodes(run(fixtureState(), "hostname", "new-name"))).toEqual(["EPERM"]);
  });

  it("ifconfig shows each address with its netmask and broadcast", () => {
    const result = text(run(fixtureState(), "ifconfig"));
    expect(result).toContain("inet 10.0.1.10  netmask 255.255.255.0  broadcast 10.0.1.255");
    expect(result).toContain("lo: flags=73<UP,LOOPBACK,RUNNING>");
    expect(text(run(fixtureState(), "ifconfig", "eth9"))).toBe(
      "eth9: error fetching interface information: Device not found",
    );
  });
});

describe("env, history and date", () => {
  it("env lists variables, sorted, with PWD", () => {
    const result = text(run(fixtureState(), "env"));
    expect(result).toContain("HOME=/home/recruit");
    expect(result).toContain("PWD=/home/recruit");
    expect(result.split("\n")).toEqual([...result.split("\n")].sort());
  });

  it("date shows in-world time, with formats", () => {
    expect(text(run(fixtureState(), "date"))).toBe("Mon Mar  2 09:01:00 UTC 2026");
    expect(text(run(fixtureState(), "date", "+%Y-%m-%d %H:%M"))).toBe("2026-03-02 09:01");
    expect(text(run(fixtureState(), "date", "-I"))).toBe("2026-03-02");
  });

  it("history refuses a count that isn't a number", () => {
    expect(errorCodes(run(fixtureState(), "history", "lots"))).toEqual(["BAD_ARGUMENT"]);
  });
});

describe("chmod", () => {
  it("sets octal and symbolic modes", () => {
    const octal = run(fixtureState(), "chmod", "600", "notes.txt");
    expect(text(run(octal.state, "ls", "-l", "notes.txt"))).toMatch(/^-rw------- /);
    expect(octal.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/notes.txt",
      change: "permissions",
    });
    const symbolic = run(fixtureState(), "chmod", "u+x,go-r", "notes.txt");
    expect(text(run(symbolic.state, "ls", "-l", "notes.txt"))).toMatch(/^-rwx------ /);
    const noRead = run(fixtureState(), "chmod", "-r", "notes.txt");
    expect(text(run(noRead.state, "cat", "notes.txt"))).toBe("cat: notes.txt: Permission denied");
  });

  it("changes folders recursively with -R, and reports with -v", () => {
    const made = shell(fixtureState(), "mkdir -p box/inner ; touch box/inner/f").state;
    const result = run(made, "chmod", "-Rv", "700", "box");
    expect(text(result)).toContain(
      "mode of 'box' changed from 0755 (rwxr-xr-x) to 0700 (rwx------)",
    );
    expect(text(run(result.state, "ls", "-l", "box/inner/f"))).toMatch(/^-rwx------ /);
  });

  it("only lets the owner change a file, and rejects unreadable modes", () => {
    expect(text(run(fixtureState(), "chmod", "777", "/etc/passwd"))).toBe(
      "chmod: changing permissions of '/etc/passwd': Operation not permitted",
    );
    expect(text(run(fixtureState(), "chmod", "999", "notes.txt"))).toContain(
      "chmod: invalid mode: '999'",
    );
    expect(text(run(fixtureState(), "chmod", "600"))).toContain("missing operand after '600'");
    expect(text(run(fixtureState(), "chmod", "600", "nope"))).toBe(
      "chmod: cannot access 'nope': No such file or directory",
    );
  });
});

describe("chown", () => {
  it("won't let an ordinary account give a file away", () => {
    expect(text(run(fixtureState(), "chown", "alex", "notes.txt"))).toBe(
      "chown: changing ownership of 'notes.txt': Operation not permitted",
    );
    expect(text(run(fixtureState(), "chown", "mallory", "notes.txt"))).toBe(
      "chown: invalid user: 'mallory'",
    );
  });

  it("lets an owner regroup a file into their own group", () => {
    const result = run(fixtureState(), "chown", ":adm", "notes.txt");
    expect(text(run(result.state, "ls", "-l", "notes.txt"))).toMatch(/ recruit adm /);
    expect(result.events).toContainEqual({
      type: "file.changed",
      hostId: "ws-01",
      path: "/home/recruit/notes.txt",
      change: "owner",
    });
  });
});

describe("sudo", () => {
  it("refuses an account that isn't in the sudo group", () => {
    const result = run(fixtureState(), "sudo", "cat", "/etc/shadow");
    expect(text(result)).toBe(
      "sudo: recruit is not in the sudoers file. This incident will be reported.",
    );
    expect(errorCodes(result)).toEqual(["SUDO_DENIED"]);
    expect(result.exitCode).toBe(1);
    expect(errorCodes(run(fixtureState(), "sudo", "-l"))).toEqual(["SUDO_DENIED"]);
  });

  it("runs one command as root for a sudoer, then comes back", () => {
    const result = run(sudoerState(), "sudo", "cat", "/etc/shadow");
    expect(text(result)).toMatch(/^root:\*:/);
    expect(result.state.session.user).toBe("recruit");
    expect(
      result.events
        .filter((event) => event.type === "command.run")
        .map((event) => "line" in event && event.line),
    ).toEqual(["cat /etc/shadow", "sudo cat /etc/shadow"]);
    expect(text(run(sudoerState(), "sudo", "whoami"))).toBe("root");
    expect(text(run(sudoerState(), "sudo", "-l"))).toContain("(ALL : ALL) ALL");
  });

  it("lets root give files away through sudo", () => {
    const result = run(sudoerState(), "sudo", "chown", "alex", "notes.txt");
    expect(text(run(result.state, "ls", "-l", "notes.txt"))).toMatch(/ alex +recruit /);
  });

  it("can't run shell built-ins or open a root shell", () => {
    expect(text(run(sudoerState(), "sudo", "cd", "/root"))).toBe("sudo: cd: command not found");
    expect(errorCodes(run(sudoerState(), "sudo", "-i"))).toEqual(["BAD_FLAG"]);
    expect(errorCodes(run(sudoerState(), "sudo"))).toEqual(["MISSING_ARGUMENT"]);
  });
});
