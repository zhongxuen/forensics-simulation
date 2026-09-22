import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = {
  title: {
    template: "%s – Candlewright: Incident Room",
    default: "Candlewright: Incident Room",
  },
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell nextStep={FIRST_STEP}>{children}</AppShell>;
}
