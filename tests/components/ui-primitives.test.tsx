import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "@/components/ui/menu";
import { ObjectiveTick } from "@/components/ui/objective-tick";
import { SplitPane } from "@/components/ui/split-pane";

/**
 * The primitives from prompt UX.1 (docs/UIUX.md) that take input: the Menu's ARIA menu button
 * pattern, the SplitPane's separator keys, and the ObjectiveTick's current state.
 */

function renderMenu() {
  const copy = vi.fn();
  const restart = vi.fn();
  render(
    <>
      <Menu
        label="Case"
        items={[
          { id: "copy", label: "Copy transcript", onSelect: copy },
          { id: "export", label: "Export chain of custody", onSelect: vi.fn(), disabled: true },
          { id: "restart", label: "Start the case again", onSelect: restart, tone: "danger" },
        ]}
      />
      <button type="button">Elsewhere</button>
    </>,
  );
  return { copy, restart, button: screen.getByRole("button", { name: "Case" }) };
}

describe("Menu", () => {
  it("is a menu button that opens on its first item", async () => {
    const user = userEvent.setup();
    const { button } = renderMenu();
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: "Case" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy transcript" }));
  });

  it("moves with the arrows, skipping an item that can't be picked, and wraps", async () => {
    const user = userEvent.setup();
    const { button } = renderMenu();
    button.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy transcript" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Start the case again" }),
    );
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy transcript" }));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Start the case again" }),
    );
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy transcript" }));
    await user.keyboard("s");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Start the case again" }),
    );
  });

  it("opens on its last item with Arrow Up", async () => {
    const user = userEvent.setup();
    const { button } = renderMenu();
    button.focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Start the case again" }),
    );
  });

  it("closes on Escape and hands focus back to the button", async () => {
    const user = userEvent.setup();
    const { button, copy } = renderMenu();
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(copy).not.toHaveBeenCalled();
  });

  it("runs the picked item's action after focus is back on the button", async () => {
    const user = userEvent.setup();
    const { button, restart } = renderMenu();
    restart.mockImplementation(() => expect(document.activeElement).toBe(button));
    await user.click(button);
    await user.keyboard("{End}{Enter}");
    expect(restart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("ignores an item that can't be picked", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Case" }));
    const disabled = screen.getByRole("menuitem", { name: "Export chain of custody" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    await user.click(disabled);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("closes on a click outside", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Case" }));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });
});

describe("SplitPane", () => {
  function renderSplit() {
    render(
      <SplitPane
        label="Resize the terminal and the case views"
        start={<p>Terminal</p>}
        end={<p>Views</p>}
        defaultRatio={50}
        min={20}
        max={80}
      />,
    );
    return screen.getByRole("separator", { name: "Resize the terminal and the case views" });
  }

  it("is a focusable separator that reports the start pane's width", () => {
    const handle = renderSplit();
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
    expect(handle.getAttribute("aria-valuemin")).toBe("20");
    expect(handle.getAttribute("aria-valuemax")).toBe("80");
    const start = document.getElementById(handle.getAttribute("aria-controls") ?? "");
    expect(start?.textContent).toContain("Terminal");
    expect(start?.style.flexBasis).toBe("50%");
  });

  it("moves 5% per arrow key, and snaps with Home and End", async () => {
    const user = userEvent.setup();
    const handle = renderSplit();
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(handle.getAttribute("aria-valuenow")).toBe("55");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle.getAttribute("aria-valuenow")).toBe("45");
    await user.keyboard("{Home}");
    expect(handle.getAttribute("aria-valuenow")).toBe("20");
    await user.keyboard("{ArrowLeft}");
    expect(handle.getAttribute("aria-valuenow")).toBe("20");
    await user.keyboard("{End}");
    expect(handle.getAttribute("aria-valuenow")).toBe("80");
  });

  it("goes back to where it started on a double-click", async () => {
    const user = userEvent.setup();
    const handle = renderSplit();
    handle.focus();
    await user.keyboard("{End}");
    fireEvent.doubleClick(handle);
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
  });
});

describe("ObjectiveTick", () => {
  it("marks the current objective with Now, aria-current and its details", () => {
    render(
      <ul>
        <ObjectiveTick status="current" details={<p>Why it matters</p>}>
          Check the write-blocker.
        </ObjectiveTick>
      </ul>,
    );
    const item = screen.getByRole("listitem");
    expect(item.getAttribute("aria-current")).toBe("step");
    expect(item?.textContent).toContain("Now: Check the write-blocker.");
    expect(screen.getByText("Why it matters")).toBeTruthy();
  });

  it("shows the success line in primary text behind the reward rule when done", () => {
    render(
      <ul>
        <ObjectiveTick status="done" success="The copy matches the form.">
          Verify the copy.
        </ObjectiveTick>
      </ul>,
    );
    const success = screen.getByText("The copy matches the form.");
    expect(success.classList.contains("text-primary")).toBe(true);
    expect(success.classList.contains("border-reward")).toBe(true);
    expect(success.classList.contains("text-reward")).toBe(false);
    expect(screen.getByRole("listitem").hasAttribute("aria-current")).toBe(false);
  });
});
