import { Spinner } from "@/components/ui/spinner";

/**
 * What a terminal page shows for a moment when it's opened from a link inside the app, while the
 * terminal's code arrives. (Opened directly, the page arrives with the terminal already drawn.)
 */
export function LoadingPracticeComputer() {
  return (
    <div
      role="status"
      className="flex h-[26rem] items-center justify-center gap-3 rounded-xl border border-subtle bg-term-bg text-term-dim"
    >
      <Spinner />
      Starting your practice computer…
    </div>
  );
}
