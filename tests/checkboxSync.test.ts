import { describe, expect, it } from "vitest";
import { computeCheckboxEdits } from "../src/checkboxSync";
import { DEFAULT_RULES } from "../src/rules/defaultRules";
import { ParentRule } from "../src/rules/ruleTypes";
import { IGNORE_UNKNOWN_CHECKBOX, TaskState, TaskStateWithPolicy } from "../src/taskState";

function cascade(
	doc: string,
	policy: TaskStateWithPolicy = IGNORE_UNKNOWN_CHECKBOX,
	rules: ParentRule[] = DEFAULT_RULES
): string[] {
	const lines = doc.split("\n");

	for (const edit of computeCheckboxEdits(doc, rules, policy)) {
		lines[edit.line] = edit.text;
	}

	return lines;
}

function cloneRules(): ParentRule[] {
	return DEFAULT_RULES.map((rule) => ({ ...rule }));
}

describe("default rules", () => {
	it.each([
		["all children done", "- [ ] p\n  - [x] a\n  - [x] b", "- [x] p"],
		["all children cancelled", "- [ ] p\n  - [-] a\n  - [-] b", "- [-] p"],
		["all children forwarded", "- [ ] p\n  - [>] a\n  - [>] b", "- [>] p"],
		["all children todo", "- [x] p\n  - [ ] a\n  - [ ] b", "- [ ] p"],
		["all children scheduling", "- [ ] p\n  - [<] a\n  - [<] b", "- [/] p"],
		["children done, cancelled and forwarded", "- [ ] p\n  - [x] a\n  - [-] b\n  - [>] c", "- [x] p"],
		["mixed progress", "- [ ] p\n  - [x] a\n  - [ ] b", "- [/] p"]
	])("%s", (_name, doc, expectedParent) => {
		expect(cascade(doc)[0]).toBe(expectedParent);
	});

	it("leaves a task with no children alone", () => {
		expect(computeCheckboxEdits("- [x] solo\n", DEFAULT_RULES, IGNORE_UNKNOWN_CHECKBOX)).toEqual([]);
	});

	it("is idempotent", () => {
		const once = cascade("- [ ] p\n  - [x] a\n  - [x] b").join("\n");

		expect(computeCheckboxEdits(once, DEFAULT_RULES, IGNORE_UNKNOWN_CHECKBOX)).toEqual([]);
	});

	it("cascades through several levels", () => {
		expect(cascade("- [ ] g\n  - [ ] p\n    - [x] c").slice(0, 2)).toEqual(["- [x] g", "  - [x] p"]);
	});

	it("only changes the marker", () => {
		expect(cascade("1. [ ] keep  this *text*\n   - [x] a")[0]).toBe("1. [x] keep  this *text*");
	});
});

describe("unknown checkbox status", () => {
	const doc = "- [ ] p\n  - [x] a\n  - [?] b";

	it("ignores them by default, so only the known child counts", () => {
		expect(cascade(doc)[0]).toBe("- [x] p");
	});

	it("counts them as the chosen status", () => {
		expect(cascade(doc, TaskState.Todo)[0]).toBe("- [/] p");
	});

	it("never rewrites them", () => {
		expect(cascade("- [ ] p\n  - [?] a", TaskState.Done)[1]).toBe("  - [?] a");
	});
});

describe("rules edited in place", () => {
	const doc = "- [ ] p\n  - [x] a\n  - [x] b";

	it("picks up a changed outcome", () => {
		const rules = cloneRules();

		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [x] p");

		rules[0]!.outcome = TaskState.Cancelled;
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [-] p");
	});

	it("picks up a changed expression, and recovers from an invalid one", () => {
		const rules = cloneRules().slice(0, 1);
		rules[0]!.outcome = TaskState.Cancelled;

		rules[0]!.expression = "bogus";
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [ ] p");

		rules[0]!.expression = "done";
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [-] p");

		rules[0]!.expression = "todo";
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [ ] p");
	});

	it("honours enabled and rule order", () => {
		const rules = cloneRules();
		const cancelOnAnyDone: ParentRule = {
			id: "x",
			enabled: true,
			quantifier: "any",
			expression: "done",
			outcome: TaskState.Cancelled
		};

		rules.unshift(cancelOnAnyDone);
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [-] p");

		cancelOnAnyDone.enabled = false;
		expect(cascade(doc, IGNORE_UNKNOWN_CHECKBOX, rules)[0]).toBe("- [x] p");
	});
});
