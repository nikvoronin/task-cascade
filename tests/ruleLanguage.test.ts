import { describe, expect, it } from "vitest";
import { compileExpression, ruleMatches } from "../src/rules/ruleLanguage";
import { ParentRule, RuleQuantifier } from "../src/rules/ruleTypes";
import { TaskState } from "../src/taskState";

const STATES = Object.values(TaskState);

// Every non-empty subset of the statuses.
const SUBSETS: Array<readonly [string, TaskState[]]> = [];
for (let mask = 1; mask < 1 << STATES.length; mask++) {
	const set = STATES.filter((_, i) => mask & (1 << i));
	SUBSETS.push([set.join(", "), set]);
}

function rule(quantifier: RuleQuantifier, expression: string): ParentRule {
	return { id: "t", enabled: true, quantifier, expression, outcome: TaskState.Done };
}

const CASES: Array<[string, (state: TaskState) => boolean]> = [
	["done", (s) => s === TaskState.Done],
	["not done", (s) => s !== TaskState.Done],
	[
		"done or cancelled or forwarded",
		(s) => s === TaskState.Done || s === TaskState.Cancelled || s === TaskState.Forwarded
	],
	["not (cancelled or forwarded)", (s) => s !== TaskState.Cancelled && s !== TaskState.Forwarded],
	["(todo or done) and not done", (s) => s === TaskState.Todo],
	["not (todo or in-progress)", (s) => s !== TaskState.Todo && s !== TaskState.InProgress],
	["not not done", (s) => s === TaskState.Done],
	["todo and done", () => false],
	["DONE Or  Todo", (s) => s === TaskState.Done || s === TaskState.Todo],
	["canceled", (s) => s === TaskState.Cancelled],
	["in_progress or scheduled", (s) => s === TaskState.InProgress || s === TaskState.Scheduling],
	["inprogress", (s) => s === TaskState.InProgress]
];

describe("compileExpression", () => {
	describe.each(CASES)("%s", (expression, predicate) => {
		const compiled = compileExpression(expression);

		it.each(SUBSETS)("ALL of [%s]", (_label, set) => {
			expect(ruleMatches(rule("all", expression), compiled, set)).toBe(set.every(predicate));
		});

		it.each(SUBSETS)("ANY of [%s]", (_label, set) => {
			expect(ruleMatches(rule("any", expression), compiled, set)).toBe(set.some(predicate));
		});
	});

	it.each(["", "   ", "bogus", "done and", "(done", "done)", "done done", "not", "done or or todo"])(
		"rejects the invalid expression %j",
		(expression) => {
			const compiled = compileExpression(expression);

			expect("error" in compiled).toBe(true);

			for (const quantifier of ["all", "any"] as const) {
				expect(ruleMatches(rule(quantifier, expression), compiled, [TaskState.Done])).toBe(false);
			}
		}
	);

	it.each([
		"canceled",
		"cancelled",
		"scheduled",
		"scheduling",
		"in_progress",
		"inprogress",
		"in-progress"
	])("accepts the status alias %s", (alias) => {
		expect("error" in compileExpression(alias)).toBe(false);
	});
});
