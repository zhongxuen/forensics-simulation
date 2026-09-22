"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * "Leave this mission?" (md-files/03-app-state-and-privacy.md, "Beginner experience"). Nothing is
 * saved, so leaving a mission mid-run loses it. While a page renders <LeaveGuard when>, the shell:
 *
 * - catches clicks on links to other pages (the sidebar, cards, anything) and asks first, in a
 *   friendly dialog, before going;
 * - asks before the command palette navigates (useGuardedNavigate);
 * - turns on the browser's own "Leave site?" prompt for reloads, closing the tab and leaving the
 *   app.
 *
 * Outside a guarded run none of this happens. Links within the same page (a skip link, a table of
 * contents) are never interrupted.
 */

export interface LeaveGuardCopy {
  readonly title: string;
  readonly description: string;
  /** The button that keeps the learner where they are. */
  readonly stayLabel: string;
  /** The button that leaves anyway. */
  readonly leaveLabel: string;
}

export const MISSION_LEAVE_COPY: LeaveGuardCopy = {
  title: "Leave this mission?",
  description: "Your progress in this mission won't be kept.",
  stayLabel: "Stay in the mission",
  leaveLabel: "Leave the mission",
};

interface LeaveGuardSlot {
  readonly setGuard: (copy: LeaveGuardCopy | null) => void;
  /** Goes to `href`, asking first while a guard is on. */
  readonly navigate: (href: string) => void;
}

const LeaveGuardContext = createContext<LeaveGuardSlot | null>(null);

function useLeaveGuardSlot(component: string): LeaveGuardSlot {
  const slot = useContext(LeaveGuardContext);
  if (!slot) throw new Error(`${component} must be rendered inside the app shell.`);
  return slot;
}

/** A link click that should leave the page: same origin, another path, no new tab or modifiers. */
function leavingHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  // Another site: the browser's own leave prompt covers it.
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search)
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Holds the guard for the whole app shell, and shows its dialog. */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [guard, setGuard] = useState<LeaveGuardCopy | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const guardRef = useRef(guard);
  useEffect(() => {
    guardRef.current = guard;
  }, [guard]);

  useEffect(() => {
    if (!guard) return;
    // Capture on window runs before React's own handlers (on the document), so a guarded link
    // never starts navigating.
    const onClick = (event: MouseEvent) => {
      const href = leavingHref(event);
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(href);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only show the prompt when returnValue is set.
      event.returnValue = "";
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [guard]);

  const navigate = useCallback(
    (href: string) => {
      if (guardRef.current) setPending(href);
      else router.push(href);
    },
    [router],
  );

  const leave = () => {
    const href = pending;
    setPending(null);
    guardRef.current = null;
    setGuard(null);
    if (href !== null) router.push(href);
  };

  const slot = useMemo(() => ({ setGuard, navigate }), [navigate]);

  return (
    <LeaveGuardContext value={slot}>
      {children}
      <Dialog
        open={pending !== null && guard !== null}
        onClose={() => setPending(null)}
        title={guard?.title ?? MISSION_LEAVE_COPY.title}
        description={guard?.description}
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {guard?.stayLabel ?? MISSION_LEAVE_COPY.stayLabel}
            </Button>
            <Button variant="danger" onClick={leave}>
              {guard?.leaveLabel ?? MISSION_LEAVE_COPY.leaveLabel}
            </Button>
          </>
        }
      />
    </LeaveGuardContext>
  );
}

/**
 * Asks before the learner leaves the page, while `when` is true: in the app, and through the
 * browser's leave-page prompt. Renders nothing itself.
 */
export function LeaveGuard({
  when,
  copy = MISSION_LEAVE_COPY,
}: {
  when: boolean;
  copy?: LeaveGuardCopy;
}) {
  const { setGuard } = useLeaveGuardSlot("LeaveGuard");
  useEffect(() => {
    if (!when) return;
    setGuard(copy);
    return () => setGuard(null);
  }, [when, copy, setGuard]);
  return null;
}

/** Navigation for code that doesn't use a link (the command palette): asks first while guarded. */
export function useGuardedNavigate(): (href: string) => void {
  return useLeaveGuardSlot("useGuardedNavigate").navigate;
}
