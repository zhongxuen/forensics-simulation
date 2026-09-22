"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogSurface } from "@/components/ui/dialog";
import { Toast, ToastViewport, type ToastTone } from "@/components/ui/toast";

// The styleguide's sections are server components, which can't hand functions to client
// components. Anything that needs a callback, even a do-nothing one for a picture, lives here.

const noop = () => {};

const RESTART = {
  title: "Restart this mission?",
  description:
    "You'll go back to the briefing, and the practice computer starts fresh. Your progress in this mission won't be kept.",
};

/** The restart dialog's panel, drawn in place. */
export function DialogPicture({ loading = false }: { loading?: boolean }) {
  return (
    <DialogSurface
      title={RESTART.title}
      description={RESTART.description}
      onClose={noop}
      actions={
        <>
          <Button variant="ghost">Keep playing</Button>
          <Button variant="danger" loading={loading}>
            Restart mission
          </Button>
        </>
      }
    />
  );
}

/** A button that opens the real, modal dialog. */
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Open the real dialog
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={RESTART.title}
        description={RESTART.description}
        actions={
          <>
            <Button variant="ghost" onClick={close}>
              Keep playing
            </Button>
            <Button variant="danger" onClick={close}>
              Restart mission
            </Button>
          </>
        }
      />
    </>
  );
}

const TOASTS: Readonly<Record<ToastTone, { title: string; description: string }>> = {
  info: {
    title: "Your mentor has a hint ready",
    description: "Open the hints panel whenever you want it. Hints are always free.",
  },
  success: {
    title: "Machine reset",
    description: "The practice computer is back to how it was when the mission started.",
  },
  warning: {
    title: "You're about to leave this mission",
    description: "Your progress in this mission won't be kept.",
  },
  danger: {
    title: "Something went wrong on our end, not yours",
    description: "Try again, or reload the page.",
  },
};

const TOAST_TONES = Object.keys(TOASTS) as ToastTone[];

/** One toast drawn in place, with a Dismiss button that does nothing. */
export function ToastPicture({ tone }: { tone: ToastTone }) {
  return <Toast tone={tone} {...TOASTS[tone]} onDismiss={noop} />;
}

/** Adds real toasts to a ToastViewport in the corner of the screen, one tone after another. */
export function ToastDemo() {
  const [toasts, setToasts] = useState<ReadonlyArray<{ id: number; tone: ToastTone }>>([]);
  const nextId = useRef(0);

  const show = () => {
    const id = nextId.current++;
    const tone = TOAST_TONES[id % TOAST_TONES.length] ?? "info";
    setToasts((current) => [...current, { id, tone }]);
  };
  const dismiss = (id: number) =>
    setToasts((current) => current.filter((toast) => toast.id !== id));

  return (
    <>
      <Button size="sm" onClick={show}>
        Show a toast in the corner
      </Button>
      <ToastViewport>
        {toasts.map(({ id, tone }) => (
          <Toast
            key={id}
            tone={tone}
            {...TOASTS[tone]}
            onDismiss={() => dismiss(id)}
            // Problems stay until dismissed; the rest leave on their own.
            autoDismissMs={tone === "danger" ? undefined : 6000}
          />
        ))}
      </ToastViewport>
    </>
  );
}
