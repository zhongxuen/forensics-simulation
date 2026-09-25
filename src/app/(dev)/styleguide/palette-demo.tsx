"use client";

import { useRef } from "react";
import {
  CommandPalette,
  SearchButton,
  type CommandPaletteHandle,
} from "@/components/shell/command-palette";
import { LeaveGuardProvider } from "@/components/shell/leave-guard";
import type { NextStep } from "@/lib/next-step";

/**
 * The top bar's search button wired to a real command palette, as on every app page. The palette
 * navigates through the shell's leave guard, so the demo brings its own provider.
 */
export function PaletteDemo({ nextStep }: { nextStep: NextStep }) {
  const paletteRef = useRef<CommandPaletteHandle>(null);

  return (
    <LeaveGuardProvider>
      <SearchButton onClick={() => paletteRef.current?.open()} />
      <CommandPalette ref={paletteRef} nextStep={nextStep} />
    </LeaveGuardProvider>
  );
}

/** The search button alone, for the frozen pictures. It opens nothing. */
export function SearchButtonPicture() {
  return <SearchButton onClick={() => {}} />;
}
