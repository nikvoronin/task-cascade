import { App, PluginSettingTab, Setting } from "obsidian";
import type AutoParentCheckboxPlugin from "./main";
import { TaskState } from "./taskState";
import { stateToMarker } from "./checkboxSync";
import { ParentRule, RuleQuantifier } from "./rules/ruleTypes";
import { compileExpression, ruleMatches } from "./rules/ruleLanguage";
import { DEFAULT_RULES } from "./rules/defaultRules";

export interface AutoParentCheckboxSettings {
	rules: ParentRule[];
	nextRuleId: number;
	taskDotShortcutEnabled: boolean;
	unknownCheckboxDefaultState: TaskState;
}

function cloneDefaultRules(): ParentRule[] {
	return DEFAULT_RULES.map((rule) => ({ ...rule }));
}

export function createDefaultSettings(): AutoParentCheckboxSettings {
	return {
		rules: cloneDefaultRules(),
		nextRuleId: DEFAULT_RULES.length,
		taskDotShortcutEnabled: true,
		unknownCheckboxDefaultState: TaskState.Todo
	};
}

export const DEFAULT_SETTINGS: AutoParentCheckboxSettings = createDefaultSettings();

const ALL_STATES: TaskState[] = [
	TaskState.Todo,
	TaskState.Done,
	TaskState.Cancelled,
	TaskState.InProgress,
	TaskState.Forwarded,
	TaskState.Scheduling
];

const UNKNOWN_CHECKBOX_DEFAULT_STATES: TaskState[] = [
	TaskState.Todo,
	TaskState.Done,
	TaskState.Cancelled,
	TaskState.InProgress
];

const STATE_LABELS: Record<TaskState, string> = {
	[TaskState.Todo]: "Todo",
	[TaskState.Done]: "Done",
	[TaskState.Cancelled]: "Cancelled",
	[TaskState.Forwarded]: "Forwarded",
	[TaskState.InProgress]: "In Progress",
	[TaskState.Scheduling]: "Scheduling"
};

export class AutoParentRuleSettingTab extends PluginSettingTab {
	plugin: AutoParentCheckboxPlugin;
	private readonly previewStates = new Set<TaskState>();
	private includeUnknownCheckboxInPreview = false;
	private previewResultEl: HTMLElement | null = null;

	constructor(app: App, plugin: AutoParentCheckboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderPreview(containerEl);

		new Setting(containerEl)
			.setName("Rules")
			.setDesc("Rules are checked top to bottom; the first match wins.")
			.setHeading();

		new Setting(containerEl)
			.setName("Unknown checkbox status")
			.setDesc(
				"Default value used when a checkbox has a single unrecognized status character " +
					"(e.g. \"- [?]\"). List items that aren't checkboxes at all, and checkboxes " +
					"with empty or multi-character brackets (e.g. \"- []\", \"- [xy]\"), are " +
					"ignored and never affect a parent's rules."
			)
			.addDropdown((dropdown) => {
				for (const state of UNKNOWN_CHECKBOX_DEFAULT_STATES) {
					dropdown.addOption(state, STATE_LABELS[state]);
				}

				dropdown
					.setValue(this.plugin.settings.unknownCheckboxDefaultState)
					.onChange(async (value) => {
						this.plugin.settings.unknownCheckboxDefaultState = value as TaskState;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.rules.forEach((rule, index) => {
			this.renderRuleRow(containerEl, rule, index);
		});

		const actionsSetting = new Setting(containerEl);
		actionsSetting.settingEl.addClass("apc-rule-actions");

		actionsSetting
			.addButton((button) =>
				button
					.setButtonText("Reset to defaults")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.rules = cloneDefaultRules();
						this.plugin.settings.nextRuleId = DEFAULT_RULES.length;

						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addButton((button) =>
				button
					.setButtonText("Add rule")
					.setCta()
					.onClick(async () => {
						const id = String(this.plugin.settings.nextRuleId);
						this.plugin.settings.nextRuleId += 1;

						this.plugin.settings.rules.push({
							id,
							enabled: false,
							quantifier: "all",
							expression: "",
							outcome: TaskState.Todo
						});

						await this.plugin.saveSettings();
						this.display();
					})
			);


		new Setting(containerEl).setName("Task shortcuts").setHeading();
		new Setting(containerEl)
			.setName("#task. → 🏁delete shortcut")
			.setDesc("Typing a period right after #task removes '.' and appends 🏁delete to the line.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.taskDotShortcutEnabled).onChange(async (value) => {
					this.plugin.settings.taskDotShortcutEnabled = value;
					await this.plugin.saveSettings();
				})
			);
	}

	private renderPreview(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Rule preview")
			.setDesc("Check which statuses are present among the children, and see the result.")
			.setHeading();

		const previewEl = containerEl.createDiv({ cls: "apc-preview-card" });

		this.previewResultEl = previewEl.createEl("p", { cls: "apc-preview-result" });

		const statusListEl = previewEl.createDiv({ cls: "apc-preview-status-list" });

		for (const state of ALL_STATES) {
			const rowEl = statusListEl.createEl("label", { cls: "apc-preview-status" });

			const checkbox = rowEl.createEl("input", { type: "checkbox" });
			checkbox.checked = this.previewStates.has(state);

			rowEl.createSpan({ cls: "apc-preview-marker", text: `[${stateToMarker(state)}]` });
			rowEl.createSpan({ text: STATE_LABELS[state] });

			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.previewStates.add(state);
				} else {
					this.previewStates.delete(state);
				}

				this.updatePreviewResult();
			});
		}

		const unknownCheckboxRowEl = statusListEl.createEl("label", { cls: "apc-preview-status" });

		const unknownCheckboxCheckbox = unknownCheckboxRowEl.createEl("input", { type: "checkbox" });
		unknownCheckboxCheckbox.checked = this.includeUnknownCheckboxInPreview;

		unknownCheckboxRowEl.createSpan({ cls: "apc-preview-marker", text: "[⁇]" });
		unknownCheckboxRowEl.createSpan({
			text: `Checkbox with unrecognized status ` +
				`(as "${STATE_LABELS[this.plugin.settings.unknownCheckboxDefaultState]}")`});

		unknownCheckboxCheckbox.addEventListener("change", () => {
			this.includeUnknownCheckboxInPreview = unknownCheckboxCheckbox.checked;
			this.updatePreviewResult();
		});

		this.updatePreviewResult();
	}

	private updatePreviewResult(): void {
		if (!this.previewResultEl) return;

		if (this.previewStates.size === 0 && !this.includeUnknownCheckboxInPreview) {
			this.previewResultEl.setText("- [ ] Check at least one status...");
			return;
		}

		const childStates = Array.from(this.previewStates);

		if (this.includeUnknownCheckboxInPreview) {
			childStates.push(this.plugin.settings.unknownCheckboxDefaultState);
		}

		let matchedRuleNumber: number | null = null;
		let outcome: TaskState | null = null;

		for (let i = 0; i < this.plugin.settings.rules.length; i++) {
			const rule = this.plugin.settings.rules[i]!;

			if (!rule.enabled) continue;

			const compiled = compileExpression(rule.expression);

			if (ruleMatches(rule, compiled, childStates)) {
				matchedRuleNumber = i + 1;
				outcome = rule.outcome;
				break;
			}
		}

		this.previewResultEl.setText(
			outcome !== null && matchedRuleNumber !== null
				? `- [${stateToMarker(outcome)}] ${STATE_LABELS[outcome]} ← Rule ${matchedRuleNumber}`
				: "No rule matched — the parent stays unchanged..."
		);
	}

	private renderRuleRow(containerEl: HTMLElement, rule: ParentRule, index: number): void {
		const setting = new Setting(containerEl).setName(`Rule ${index + 1}`);
		setting.settingEl.addClass("apc-rule-row");

		setting.addToggle((toggle) =>
			toggle.setValue(rule.enabled).onChange(async (value) => {
				rule.enabled = value;
				this.updatePreviewResult();
				await this.plugin.saveSettings();
			})
		);

		setting.addDropdown((dropdown) =>
			dropdown
				.addOptions({ all: "ALL", any: "ANY" })
				.setValue(rule.quantifier)
				.onChange(async (value) => {
					rule.quantifier = value as RuleQuantifier;
					this.updatePreviewResult();
					await this.plugin.saveSettings();
				})
		);

		setting.addText((text) => {
			text.inputEl.addClass("apc-rule-expression");
			text
				.setPlaceholder("Done or cancelled or forwarded")
				.setValue(rule.expression)
				.onChange(async (value) => {
					rule.expression = value;
					this.updateRowValidity(setting, rule);
					this.updatePreviewResult();
					await this.plugin.saveSettings();
				});
		});

		setting.addDropdown((dropdown) => {
			for (const state of ALL_STATES) {
				dropdown.addOption(state, STATE_LABELS[state]);
			}

			dropdown.setValue(rule.outcome).onChange(async (value) => {
				rule.outcome = value as TaskState;
				this.updatePreviewResult();
				await this.plugin.saveSettings();
			});
		});

		setting.addExtraButton((button) =>
			button
				.setIcon("arrow-up")
				.setTooltip("Move up")
				.onClick(async () => {
					await this.moveRule(index, index - 1);
				})
		);

		setting.addExtraButton((button) =>
			button
				.setIcon("arrow-down")
				.setTooltip("Move down")
				.onClick(async () => {
					await this.moveRule(index, index + 1);
				})
		);

		setting.addExtraButton((button) =>
			button
				.setIcon("trash-2")
				.setTooltip("Delete rule")
				.onClick(async () => {
					this.plugin.settings.rules.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				})
		);

		this.updateRowValidity(setting, rule);
	}

	private updateRowValidity(setting: Setting, rule: ParentRule): void {
		const compiled = compileExpression(rule.expression);

		if ("error" in compiled) {
			setting.setDesc(`Expression error: ${compiled.error}`);
			setting.settingEl.classList.add("apc-rule-error");
		} else {
			setting.setDesc("");
			setting.settingEl.classList.remove("apc-rule-error");
		}
	}

	private async moveRule(from: number, to: number): Promise<void> {
		const rules = this.plugin.settings.rules;

		if (to < 0 || to >= rules.length) return;

		const [moved] = rules.splice(from, 1);
		rules.splice(to, 0, moved!);

		await this.plugin.saveSettings();
		this.display();
	}
}
