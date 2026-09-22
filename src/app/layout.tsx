import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SettingsBootScript } from "@/components/shell/settings-boot-script";
import { TerminalThemeStyles } from "@/components/shell/terminal-theme-styles";
import { UsageAnalytics } from "@/components/shell/usage-analytics";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Candlewright: Incident Room",
  description:
    "Join a blue team and work out what happened after a break-in, from a disk image, a memory dump and logs. No experience needed, and everything is simulated: nothing touches a real computer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-surface-base text-primary antialiased`}
      // SettingsBootScript sets data-sidebar, data-motion and data-terminal-theme here before React
      // loads. This silences those expected attribute differences on <html> only, not on anything
      // inside it.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">
        <TerminalThemeStyles />
        <SettingsBootScript />
        {children}
        <UsageAnalytics />
      </body>
    </html>
  );
}
