# Task Cascade

Task Cascade keeps a parent checklist item's status in sync with its children, and adds a quick shortcut for tagging a task to be deleted once it's done.

![Task Hierarchy Demo](https://github.com/user-attachments/assets/96faf4b3-4308-4e95-9d76-8094391caad7)

_※ Note: Tasks are ordered from top to bottom. Their horizontal positions in the image are adjusted for compactness and do not reflect the actual layout._

- [How it works](#how-it-works)
- [Supported statuses](#supported-statuses)
- [Configurable rules](#configurable-rules)
- [Disabling the cascade sync for a note](#disabling-the-cascade-sync-for-a-note)
- [Settings](#settings)
- [Manual installation](#manual-installation)
- [Alternatives](#alternatives)
- [Development](#development)
- [Release Notes](#release-notes)

> [!WARNING]
> Task Cascade 1.0.0 and later requires Obsidian 1.13.0 or newer due to its use of the declarative settings API.\
> If you're using an older version of Obsidian, install [Task Cascade 0.2.2](https://github.com/nikvoronin/task-cascade/releases/tag/0.2.2), the last compatible release.

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

A checkbox whose status is a single character that isn't one of the markers above (e.g. `- [⁇]`) is ignored by default: it is skipped like a plain list item or an empty `- []`, and never affects its parent. Checkboxes nested under an ignored checkbox attach to the nearest checkbox above it instead, so a parent whose only children are unrecognized checkboxes is left untouched.

Pick a status instead — `Todo`, `Done`, `Cancelled`, or `In Progress` — to make such checkboxes count toward their parent's rules as that status. Plain list items that aren't checkboxes at all, and malformed checkboxes with empty (`- []`) or multi-character (`- [xyz]`) brackets, are always ignored — they never affect a parent's computed status.

### Where checkboxes are ignored

Checkboxes that only look like tasks are never read or rewritten, and never affect a parent's status. This covers:

- fenced code blocks (```` ``` ```` and `~~~`)
- the note's frontmatter
- `$$` math blocks
- `%%` comments and `<!-- -->` HTML comments
- blockquotes and callouts (lines starting with `>`)

## Configurable rules

Whenever you edit a checklist, Task Cascade looks at each parent's children and decides whether the parent's own status should change. The decision is made by an ordered list of rules — the first rule that matches wins.

Each rule has:

- An **ALL** or **ANY** quantifier — does _every_ child need to match, or just _one_?
- An **expression** combining status names with `and`, `or`, and `not` (e.g. `done or cancelled or forwarded`).
- An **outcome** status the parent becomes when the rule matches.
- An **enabled** switch, so a rule can be turned off without deleting it.

The default rules ship ready to use:

1. All children Done → Done
2. All children Cancelled → Cancelled
3. All children Forwarded → Forwarded
4. All children Todo → Todo
5. All children Scheduling → In Progress
6. All children Done, Cancelled, or Forwarded → Done
7. Any child not Cancelled and not Forwarded → In Progress

If nothing matches, the parent is left untouched.

## Disabling the cascade sync for a note

Add this to a note's frontmatter to turn off the parent-checkbox cascade sync for that note only:

```yaml
---
task-cascade-enable: false
---
```

The `#task.` shortcut keeps working regardless — this only opts a note out of automatic parent-checkbox updates. Omitting the key, or setting it to `true`, keeps the default (enabled) behavior.

## Settings

Open **Settings → Community plugins → Task Cascade** to:

- **Preview rules** — check off which statuses are present among a set of children and see which rule fires and what the parent would become, without touching a real file.
- **Set the unknown-checkbox default** — choose whether a checkbox with an unrecognized single-character marker is ignored (the default) or counts as Todo, Done, Cancelled, or In Progress; this same value can be toggled on in the rule preview to see its effect.
- **Edit rules** — change any rule's quantifier, expression, or outcome; add new rules; reorder or delete existing ones; reset back to the defaults at any time.
- **Toggle the `#task.` shortcut** — typing a period immediately after `#task` on a checklist line removes the period and appends `🏁delete` to the line, so you can keep typing the task's description right after the tag. Turn this off if you don't use it.

## Manual installation

If `Task Cascade` isn't available in the Community plugins catalog yet, you can install it manually from the GitHub repository:

1. Go to the [latest release](https://github.com/nikvoronin/task-cascade/releases) and download `main.js`, `manifest.json`, and `styles.css`.
2. Create a folder named `task-cascade` inside your vault's `.obsidian/plugins/` directory and place the three downloaded files there.
3. In Obsidian, open **Settings → Community plugins**, reload the plugin list if needed, and enable **Task Cascade**.

## Alternatives

- [Checkbox Autochecker](https://github.com/klaasklee/checkbox-autochecker-obsidian) (by klaasklee) – offers predefined 3 propagation modes (Loose, Partial, and Strict) to control exactly how parent and child checkboxes sync in both upward and downward directions.
- [Checkbox Sync](https://github.com/groldsf/obsidian_check_plugin) (by groldsf) – focus on multi-status logic, this plugin provides straightforward bidirectional syncing paired with built-in rules to ignore specific files or folders from processing.

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

5. **Run the tests and the linter:**

   ```bash
   npm test
   npm run lint
   ```

   `npm test` runs the [Vitest](https://vitest.dev) suite in `tests/`; `npm run lint` runs ESLint with the Obsidian plugin rules.

## Release Notes

### 1.2.3

- Renamed the settings page CSS classes from `apc-*` to `tc-*`; custom CSS snippets that target the old class names need updating
- Fixed the default rules list in this README (there are 7 rules, including "All children Scheduling → In Progress")
- Added an automated test suite (`npm test`) and an ESLint configuration (`npm run lint`)

### 1.2.2

- Rule expressions are now compiled once and reused instead of on every editor change, which makes the cascade sync faster on small notes (no change in behavior)

### 1.2.1

- Checkboxes inside fenced code blocks, frontmatter, `$$` math blocks, and `%%` / `<!-- -->` comments are no longer treated as tasks by the cascade sync

### 1.2.0

- Added an `Ignore` option to **Unknown checkbox status**: checkboxes with an unrecognized single-character marker (e.g. `- [?]`) are skipped and never affect their parent
- **Changed default:** `Ignore` is now the default for new installs and for settings that were never saved; previously unrecognized checkboxes counted as `Todo`. To keep the old behavior, set **Unknown checkbox status** to `Todo` in **Settings → Community plugins → Task Cascade**

### 1.1.0

- Added a `task-cascade-enable: false` frontmatter key to disable the cascade sync on a per-note basis (the `#task.` shortcut is unaffected)

### 1.0.0

- Migrated the settings UI to Obsidian's new declarative Settings API (now requires Obsidian 1.13.0 or newer — see the warning above for older versions)
- Rules can now be reordered by dragging, not just with up/down buttons
- "Reset rules to defaults" now asks for confirmation before replacing all rules
- Invalid rule expressions now show a clearer error banner instead of just recoloring the row description

### 0.2.1

- Configurable default status for checkboxes with an unrecognized single-character marker (list items without a checkbox, and empty/multi-character brackets, are still ignored)

### 0.1.0

- Preview plate
- Auto removed task option
- Configurable rules
- Delete task on done when dot at the end
