# tests/components

Vitest component tests in a simulated browser (jsdom), with Testing Library: the parts only a DOM can show, like typing into the terminal, the error screen's Try again, and the usage-counts setting. The server-rendered markup of components is tested in `tests/unit` with `react-dom/server`.

`setup.ts` adds the few browser APIs jsdom lacks (`<dialog>`, `matchMedia`, `ResizeObserver`, `getAnimations`, scrolling) and makes `fetch` fail by default.

Never import here: a real network or clock. Query by role and label, the way a player (or a screen reader) finds things.
