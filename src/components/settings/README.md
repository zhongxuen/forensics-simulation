# src/components/settings

The controls on `/settings`: `SettingsForm`, one plain-language row per setting and a "Reset settings" button. It reads and writes through `src/lib/settings` (`useSettings`, `updateSettings`, `resetSettings`) and never touches browser storage itself. When a later phase adds a setting, give it a row here with a one-line explanation a beginner understands.

- `settings-form.tsx`: the form. Settings that need a feature's own pieces (the terminal's look, with its live preview) are cards the page passes in as `children`.
- `controls.tsx`: `SettingCard`, `Switch`, `RadioGroup` (options may carry a decorative `sample`), and `useChangeSettings`, which a feature's card uses so the form can say when this browser won't save.

Never import here: features, `src/app`, `src/sim`, or `src/content`.
