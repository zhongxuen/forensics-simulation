/**
 * Settings: the only thing the app keeps between visits, and the only code allowed to touch
 * browser storage (tests/unit/storage-guard.test.ts). See README.md in this folder.
 *
 * This entry includes the useSettings hook, so import it from client components. Server
 * components that need the boot script import `@/lib/settings/boot-script` instead.
 */
export {
  DEFAULT_SETTINGS,
  NETWORK_VIEWS,
  REDUCED_MOTION_OVERRIDES,
  parseSettings,
  type NetworkView,
  type ReducedMotionOverride,
  type Settings,
} from "./schema";
export {
  SETTINGS_STORAGE_KEY,
  getSettings,
  resetSettings,
  subscribeSettings,
  updateSettings,
} from "./store";
export { useSettings } from "./use-settings";
