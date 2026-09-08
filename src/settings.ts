import { App, ButtonComponent, PluginSettingTab, Setting, setIcon } from "obsidian";
import type {
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionRender
} from "obsidian";
import type AutoParentCheckboxPlugin from "./main";
import { TaskState } from "./taskState";
import { stateToMarker } from "./checkboxSync";
import { ParentRule, RuleQuantifier } from "./rules/ruleTypes";
import { compileExpression, ruleMatches } from "./rules/ruleLanguage";
import { DEFAULT_RULES } from "./rules/defaultRules";
import { ConfirmModal } from "./confirmModal";

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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{			
				name: "Rules Preview",
				desc: "Check which statuses are present among the children, and see the result.",
				render: (setting) => {
					const previewEl = setting.descEl.createDiv({ cls: "apc-preview-card" });

					this.renderPreviewBody(previewEl);

					return () => {
						this.previewResultEl = null;
					};
				}
			},
			{
				name: "Unknown checkbox status",
				desc:
					"Default value used when a checkbox has a single unrecognized status character " +
					"(e.g. \"- [?]\"). List items that aren't checkboxes at all, and checkboxes " +
					"with empty or multi-character brackets (e.g. \"- []\", \"- [xy]\"), are " +
					"ignored and never affect a parent's rules.",
				control: {
					type: "dropdown",
					key: "unknownCheckboxDefaultState",
					options: Object.fromEntries(
						UNKNOWN_CHECKBOX_DEFAULT_STATES.map((state) => [state, STATE_LABELS[state]])
					)
				}
			},
			this.buildRulesListDefinition(),
			{
				name: "Reset rules to defaults",
				desc: "Replaces all rules with the plugin's default set.",

				render: (setting) => {
					setting.addButton((button) => {
						button
							.setButtonText("Reset to defaults")
							.setDestructive()
							.onClick(async () => {
								new ConfirmModal(
									this.app,
									"Reset rules to defaults?",
									"This will permanently replace all existing rules with the default set. "
										+ "This action cannot be undone.",
									async () => {
										this.plugin.settings.rules = cloneDefaultRules();
										this.plugin.settings.nextRuleId = DEFAULT_RULES.length;

										await this.plugin.saveSettings();
										this.update();
									},
								).open();
							});
					});
				},
			},
			{
				type: "group",
				heading: "Task shortcuts",
				items: [
					{
						name: "#task. → 🏁delete shortcut",
						desc: "Typing a period right after #task removes '.' and appends 🏁delete to the line.",
						control: { type: "toggle", key: "taskDotShortcutEnabled" }
					}
				]
			}
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);

		if (key === "unknownCheckboxDefaultState") {
			this.update();
		}
	}

	private buildRulesListDefinition(): SettingDefinitionList {
		return {
			type: "list",
			emptyState: "No rules yet — add one to get started.",
			onReorder: (oldIndex, newIndex) => {
				const rules = this.plugin.settings.rules;
				const [moved] = rules.splice(oldIndex, 1);
				rules.splice(newIndex, 0, moved!);

				void this.plugin.saveSettings();
				this.update();
			},
			onDelete: (index) => {
				this.plugin.settings.rules.splice(index, 1);

				void this.plugin.saveSettings();
				this.update();
			},
			addItem: {
				name: "Add rule",
				action: () => {
					const id = String(this.plugin.settings.nextRuleId);
					this.plugin.settings.nextRuleId += 1;

					this.plugin.settings.rules.push({
						id,
						enabled: false,
						quantifier: "all",
						expression: "",
						outcome: TaskState.Todo
					});

					void this.plugin.saveSettings();
					this.update();
				}
			},			
			items: this.plugin.settings.rules.map((rule, index) => 
				this.buildRuleDefinition(rule, index))
		};
	}

	private buildRuleDefinition(rule: ParentRule, index: number): SettingDefinitionRender {
		return {
			name: `Rule ${index + 1}`,
			render: (setting) => {
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

				this.updateRowValidity(setting, rule);
			}
		};
	}

	private renderPreviewBody(previewEl: HTMLElement): void {
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

	private updateRowValidity(setting: Setting, rule: ParentRule): void {
		const compiled = compileExpression(rule.expression);

		let errorEl = setting.settingEl.querySelector<HTMLElement>(
			".apc-rule-second-line"
		);

		if ("error" in compiled) {
			if (!errorEl) {
				errorEl = setting.settingEl.createDiv({
					cls: "apc-rule-second-line",
				});

				const iconEl = errorEl.createSpan({
					cls: "apc-rule-error-icon",
				});

				setIcon(iconEl, "circle-alert");

				errorEl.createSpan({
					cls: "apc-rule-error-text",
				});
			}

			errorEl
				.querySelector<HTMLElement>(".apc-rule-error-text")
				?.setText(`Expression error: ${compiled.error}`);
		} else {
			errorEl?.remove();
		}
	}
}
