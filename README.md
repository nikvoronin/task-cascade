# Task Cascade

Task Cascade keeps a parent checklist item's status in sync with its children, and adds a quick shortcut for tagging a task to be deleted once it's done.

![Task Hierarchy Demo](https://github.com/user-attachments/assets/96faf4b3-4308-4e95-9d76-8094391caad7)

_※ Note: Tasks are ordered from top to bottom. Their horizontal positions in the image are adjusted for compactness and do not reflect the actual layout._

- [How it works](#how-it-works)
- [Supported statuses](#supported-statuses)
- [Configurable rules](#configurable-rules)
- [Settings](#settings)
- [Manual installation](#manual-installation)
- [Development](#development)
- [Release Notes](#release-notes)

## How it works

Task Cascade watches editor changes with a short debounce, walks the checklist bottom-up so children are resolved before their parents, and only rewrites a checkbox's marker when the computed status actually differs from what's on the line — so it never touches lines that don't need to change.

## Supported statuses

| Marker | Status |
| --- | --- |
| `[ ]` | Todo |
| `[x]` | Done |
| `[-]` | Cancelled |
| `[/]` | In Progress |
| `[>]` | Forwarded |
| `[<]` | Scheduling |

### Unrecognized or missing checkbox status

A checkbox whose status is a single character that isn't one of the markers above (e.g. `- [⁇]`) counts toward its parent's rules as a configurable default status — `Todo`, `Done`, `Cancelled`, or `In Progress` (`Todo` by default). Plain list items that aren't checkboxes at all, and malformed checkboxes with empty (`- []`) or multi-character (`- [xyz]`) brackets, are always ignored — they never affect a parent's computed status.

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

Open **Settings → Community plugins → Task Cascade** to:

- **Preview rules** — check off which statuses are present among a set of children and see which rule fires and what the parent would become, without touching a real file.
- **Set the unknown-checkbox default** — pick which status (Todo, Done, Cancelled, or In Progress) a checkbox with an unrecognized single-character marker counts as; this same value can be toggled on in the rule preview to see its effect.
- **Edit rules** — change any rule's quantifier, expression, or outcome; add new rules; reorder or delete existing ones; reset back to the defaults at any time.
- **Toggle the `#task.` shortcut** — typing a period immediately after `#task` on a checklist line removes the period and appends `🏁delete` to the line, so you can keep typing the task's description right after the tag. Turn this off if you don't use it.

## Manual installation

If `Task Cascade` isn't available in the Community plugins catalog yet, you can install it manually from the GitHub repository:

1. Go to the [latest release](https://github.com/nikvoronin/task-cascade/releases) and download `main.js`, `manifest.json`, and `styles.css`.
2. Create a folder named `task-cascade` inside your vault's `.obsidian/plugins/` directory and place the three downloaded files there.
3. In Obsidian, open **Settings → Community plugins**, reload the plugin list if needed, and enable **Task Cascade**.

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

### 0.2.1

- Configurable default status for checkboxes with an unrecognized single-character marker (list items without a checkbox, and empty/multi-character brackets, are still ignored)

### 0.1.0

- Preview plate
- Auto removed task option
- Configurable rules
- Delete task on done when dot at the end
