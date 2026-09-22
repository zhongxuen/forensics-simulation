"use client";

import { useRef } from "react";
import {
  CommandPalette,
  SearchButton,
  type CommandPaletteHandle,
} from "@/components/shell/command-palette";
import type { NextStep } from "@/lib/next-step";

/** The top bar's search button wired to a real command palette, as on every app page. */
export function PaletteDemo({ nextStep }: { nextStep: NextStep }) {
  const paletteRef = useRef<CommandPaletteHandle>(null);

  return (
    <>
      <SearchButton onClick={() => paletteRef.current?.open()} />
      <CommandPalette ref={paletteRef} nextStep={nextStep} />
    </>
  );
}

/** The search button alone, for the frozen pictures. It opens nothing. */
export function SearchButtonPicture() {
  return <SearchButton onClick={() => {}} />;
}
