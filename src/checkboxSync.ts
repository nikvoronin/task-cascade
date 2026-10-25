import { IGNORE_UNKNOWN_CHECKBOX, TaskState, TaskStateWithPolicy } from "./taskState";
import { RegionTracker } from "./ignoredRegions";
import { ParentRule } from "./rules/ruleTypes";
import { CompiledExpression, compileExpression, ruleMatches } from "./rules/ruleLanguage";

export { TaskState };

export const TASK_RE = /^(\s*)([-*+]|\d+[.)])\s+\[([ xX\-/><])\](.*)$/;

const UNKNOWN_CHECKBOX_RE = /^(\s*)([-*+]|\d+[.)])\s+\[(.)\](.*)$/;

const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])(?:\s|$)/;

type TaskLine = {
	line: number;
	raw: string;
	indent: number;
	state: TaskState;
	isCheckbox: boolean;
	// A list item that never counts as a child state: it only keeps its subtree out of other branches.
	transparent: boolean;
	parent?: number;
	children: number[];
};

function markerToState(marker: string): TaskState {
	switch (marker) {
		case "x":
		case "X":
			return TaskState.Done;
		case "-":
			return TaskState.Cancelled;
		case ">":
			return TaskState.Forwarded;
		case "/":
			return TaskState.InProgress;
		case "<":
			return TaskState.Scheduling;
		default:
			return TaskState.Todo;
	}
}

export function stateToMarker(state: TaskState): string {
	switch (state) {
		case TaskState.Done:
			return "x";
		case TaskState.Cancelled:
			return "-";
		case TaskState.Forwarded:
			return ">";
		case TaskState.InProgress:
			return "/";
		case TaskState.Scheduling:
			return "<";
		default:
			return " ";
	}
}

function measureIndent(indent: string): number {
	let width = 0;

	for (const char of indent) {
		width += char === "\t" ? 4 : 1;
	}

	return width;
}

function buildTaskTree(tasks: TaskLine[]) {
	const stack: number[] = [];

	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i]!;

		while (
			stack.length > 0 &&
			tasks[stack[stack.length - 1]!]!.indent >= task.indent
		) {
			stack.pop();
		}

		task.parent = stack[stack.length - 1];
		stack.push(i);
	}

	// Tasks under a transparent item count toward the nearest real ancestor in their own branch.
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i]!;

		if (task.transparent) continue;

		let ancestor = task.parent;

		while (ancestor !== undefined 
			&& tasks[ancestor]!.transparent) 
		{
			ancestor = tasks[ancestor]!.parent;
		}

		if (ancestor !== undefined) {
			tasks[ancestor]!.children.push(i);
		}
	}
}

type CompiledRule = { rule: ParentRule; compiled: CompiledExpression };

// Rules are edited in place, so each entry remembers the expression it was compiled from.
const compiledCache = new WeakMap<ParentRule, { expression: string; compiled: CompiledExpression }>();

function getCompiled(rule: ParentRule): CompiledExpression {
	const cached = compiledCache.get(rule);
	if (cached && cached.expression === rule.expression) return cached.compiled;

	const compiled = compileExpression(rule.expression);
	compiledCache.set(rule, { expression: rule.expression, compiled });

	return compiled;
}

// Rules are checked in list order: the first match wins.
function computeParentStateFromRules(
	childStates: TaskState[],
	compiledRules: CompiledRule[]
): TaskState | null {
	for (const { rule, compiled } of compiledRules) {
		if (!rule.enabled) continue;
		if (ruleMatches(rule, compiled, childStates)) return rule.outcome;
	}

	return null;
}

function replaceCheckboxMarker(line: string, marker: string): string {
	return line.replace(
		TASK_RE,
		(_full, indent, bullet, _state, rest) => `${indent}${bullet} [${marker}]${rest}`
	);
}

export function computeCheckboxEdits(
	content: string,
	rules: ParentRule[],
	defaultTaskState: TaskStateWithPolicy
): Array<{ line: number; text: string }> {
	const compiledRules: CompiledRule[] = rules.map((rule) => ({
		rule,
		compiled: getCompiled(rule)
	}));

	const lines = content.split("\n");
	const regions = new RegionTracker(lines);
	const tasks: TaskLine[] = [];
	const lineToTaskIndex = new Map<number, number>();

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const raw = lines[lineNo]!;

		// Code blocks, frontmatter, math and comments hold no real tasks.
		if (regions.isIgnored(raw, lineNo)) continue;

		const taskMatch = raw.match(TASK_RE);

		if (taskMatch) {
			lineToTaskIndex.set(lineNo, tasks.length);
			tasks.push({
				line: lineNo,
				raw,
				indent: measureIndent(taskMatch[1]!),
				state: markerToState(taskMatch[3]!),
				isCheckbox: true,
				transparent: false,
				children: []
			});
			continue;
		}

		const unknownMatch = raw.match(UNKNOWN_CHECKBOX_RE);

		// An ignored unknown checkbox is skipped like a plain list item: it never counts toward a parent.
		if (unknownMatch 
			&& defaultTaskState !== IGNORE_UNKNOWN_CHECKBOX) 
		{
			lineToTaskIndex.set(lineNo, tasks.length);
			tasks.push({
				line: lineNo,
				raw,
				indent: measureIndent(unknownMatch[1]!),
				state: defaultTaskState,
				isCheckbox: false,
				transparent: false,
				children: []
			});
			continue;
		}

		const itemMatch = raw.match(LIST_ITEM_RE);

		if (!itemMatch) continue;

		tasks.push({
			line: lineNo,
			raw,
			indent: measureIndent(itemMatch[1]!),
			state: TaskState.Todo,
			isCheckbox: false,
			transparent: true,
			children: []
		});
	}

	if (tasks.length === 0) return [];

	buildTaskTree(tasks);

	const desiredState = new Map<number, TaskState>();

	// Walk bottom-up so children's state is computed first.
	for (let i = tasks.length - 1; i >= 0; i--) {
		const task = tasks[i]!;

		if (!task.isCheckbox || task.children.length === 0) continue;

		const childStates = task.children.map((childIndex) => {
			const child = tasks[childIndex]!;
			return desiredState.get(child.line) ?? child.state;
		});

		const computed = computeParentStateFromRules(childStates, compiledRules);

		if (computed !== null) {
			desiredState.set(task.line, computed);
		}
	}

	const edits: Array<{ line: number; text: string }> = [];

	for (const [lineNo, state] of desiredState.entries()) {
		const taskIndex = lineToTaskIndex.get(lineNo);
		if (taskIndex === undefined) continue;

		const task = tasks[taskIndex]!;

		if (task.state === state) continue;

		edits.push({
			line: lineNo,
			text: replaceCheckboxMarker(task.raw, stateToMarker(state))
		});
	}

	return edits;
}
