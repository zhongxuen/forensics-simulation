export { FOCUS_RING } from "@/components/ui/focus-ring";

/**
 * In the collapsed icon rail, a sidebar item's text becomes a tooltip beside the icon, shown on
 * hover and keyboard focus. It stays in the accessibility tree the whole time, so the item keeps
 * its name. Needs a `group` (and `relative`) parent.
 */
export const RAIL_TOOLTIP =
  "rail:pointer-events-none rail:absolute rail:top-1/2 rail:left-full rail:z-40 rail:ml-3 rail:w-max rail:max-w-64 rail:-translate-y-1/2 rail:rounded-md rail:border rail:border-strong rail:bg-surface-overlay rail:px-3 rail:py-2 rail:text-left rail:text-primary rail:opacity-0 rail:shadow-lg rail:group-hover:opacity-100 rail:group-focus-visible:opacity-100";
