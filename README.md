# Task Cascade

Task Cascade keeps a parent checklist item's status in sync with its children, and adds a quick shortcut for tagging a task to be deleted once it's done.

## Supported statuses

| Marker | Status |
| --- | --- |
| `[ ]` | Todo |
| `[x]` | Done |
| `[-]` | Cancelled |
| `[/]` | In Progress |
| `[>]` | Forwarded |
| `[<]` | Scheduling |

## Configurable rules

Whenever you edit a checklist, Task Cascade looks at each parent's children and decides whether the parent's own status should change. The decision is made by an ordered list of rules — the first rule that matches wins.

Each rule has:

- An **ALL** or **ANY** quantifier — does *every* child need to match, or just *one*?
- An **expression** combining status names with `and`, `or`, and `not` (e.g. `done or cancelled or forwarded`).
- An **outcome** status the parent becomes when the rule matches.
- An **enabled** switch, so a rule can be turned off without deleting it.

The default rules ship ready to use:

1. All children Done → Done
2. All children Cancelled → Cancelled
3. All children Forwarded → Forwarded
4. All children Todo → Todo
5. All children Done, Cancelled, or Forwarded → Done
6. Any child not Cancelled and not Forwarded → In Progress

If nothing matches, the parent is left untouched.

## Settings

Open **Settings → Task Cascade** to:

- **Preview rules** — check off which statuses are present among a set of children and see which rule fires and what the parent would become, without touching a real file.
- **Edit rules** — change any rule's quantifier, expression, or outcome; add new rules; reorder or delete existing ones; reset back to the defaults at any time.
- **Toggle the `#task.` shortcut** — typing a period immediately after `#task` on a checklist line removes the period and appends `🏁delete` to the line, so you can keep typing the task's description right after the tag. Turn this off if you don't use it.

## How it works

Task Cascade watches editor changes with a short debounce, walks the checklist bottom-up so children are resolved before their parents, and only rewrites a checkbox's marker when the computed status actually differs from what's on the line — so it never touches lines that don't need to change.

## Development

Requirements: Node.js and npm installed.

1. **Check `esbuild.config.mjs` exists.** The `dev`/`build` npm scripts call it directly (`node esbuild.config.mjs`) — without it the build won't even start. The standard config bundles from `src/main.ts` to `main.js`, with `external: ["obsidian", "electron", ...]`, `format: "cjs"`.

2. **Install dependencies:**

   ```bash
   npm install
   ```

   Creates `node_modules` and `package-lock.json`, using `devDependencies` (esbuild, typescript) and `dependencies` (obsidian).

3. **Build the plugin:**

   ```bash
   npm run build
   ```

   Equivalent to `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` — type-checks first, then produces a minified `main.js`.

4. **Watch mode for development (optional):**

   ```bash
   npm run dev
   ```

   Runs esbuild in watch mode without minification (`node esbuild.config.mjs` without `production`).

   Verify the build succeeded by checking `npm run build` exits with code `0` and `main.js` has been updated.

## Release Notes

### 0.1.0

- Preview plate
- Auto removed task option
- Changing rules
- Delete task on done when dot at the end
