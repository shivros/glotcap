# Theme Architecture

## Ownership

- `src/styles.css`: global token definitions and base-layer styling.
- `src/theme/semantic.ts`: semantic class contracts consumed by feature surfaces.
- `src/components/ui/*`: reusable primitives and shared wrappers.
- `src/components/*` and `src/routes/*`: feature composition only.

## Rules

1. Feature components should not reference raw `var(--glotcap-*)` classes.
2. Add new visual contracts in `src/theme/semantic.ts` when a style is reused.
3. Keep one-off experimental styling in `src/components/component-example.tsx` only.
4. Prefer primitive variants (`Button`, `Card`, `Badge`, `Select`) before adding custom classes.

## Why

- Improves SRP by separating visual policy from feature behavior.
- Improves OCP by allowing style updates through contracts instead of file-by-file edits.
- Improves DIP by making features depend on semantic abstractions rather than concrete token names.
