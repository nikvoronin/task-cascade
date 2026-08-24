import { Editor, MarkdownFileInfo, MarkdownView, Plugin } from "obsidian";
import { computeCheckboxEdits } from "./checkboxSync";
import { computeTaskDotShortcut } from "./taskTagShortcut";
import {
	AutoParentCheckboxSettings,
	AutoParentRuleSettingTab,
	createDefaultSettings
} from "./settings";

export default class AutoParentCheckboxPlugin extends Plugin {
	settings!: AutoParentCheckboxSettings;
	private isApplying = false;
	private timer: number | null = null;

	async onload() {
		const loadedData = (await this.loadData()) as Partial<AutoParentCheckboxSettings> | null;
		this.settings = Object.assign(createDefaultSettings(), loadedData);

		this.addSettingTab(new AutoParentRuleSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(editor: Editor, _info: MarkdownView | MarkdownFileInfo) => {
					this.handleEditorChange(editor);
				}
			)
		);
	}

	onunload() {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private handleEditorChange(editor: Editor) {
		if (this.isApplying) return;

		this.applyTaskDotShortcut(editor);
		this.scheduleUpdate(editor);
	}

	private applyTaskDotShortcut(editor: Editor) {
		if (!this.settings.taskDotShortcutEnabled) return;

		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const shortcut = computeTaskDotShortcut(line, cursor.ch);

		if (!shortcut) return;

		this.isApplying = true;

		try {
			editor.replaceRange(
				shortcut.newLine,
				{ line: cursor.line, ch: 0 },
				{ line: cursor.line, ch: line.length },
				"auto-parent-checkbox"
			);

			editor.setCursor({ line: cursor.line, ch: shortcut.newCursorCh });
		} finally {
			this.isApplying = false;
		}
	}

	private scheduleUpdate(editor: Editor) {
		if (this.isApplying) return;

		if (this.timer !== null) {
			window.clearTimeout(this.timer);
		}

		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.updateParentCheckboxes(editor);
		}, 80);
	}

	private updateParentCheckboxes(editor: Editor) {
		if (this.isApplying) return;

		const edits = computeCheckboxEdits(
			editor.getValue(),
			this.settings.rules,
			this.settings.unknownCheckboxDefaultState
		);

		if (edits.length === 0) return;

		this.isApplying = true;

		try {
			// Bottom-up, so line numbers don't shift.
			edits.sort((a, b) => b.line - a.line);

			for (const edit of edits) {
				const oldLine = editor.getLine(edit.line);

				editor.replaceRange(
					edit.text,
					{ line: edit.line, ch: 0 },
					{ line: edit.line, ch: oldLine.length },
					"auto-parent-checkbox"
				);
			}
		} finally {
			this.isApplying = false;
		}
	}
}
