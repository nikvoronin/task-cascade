import { TaskState } from "../taskState";
import { ParentRule } from "./ruleTypes";

export const DEFAULT_RULES: ParentRule[] = [
	{ id: "0", enabled: true, quantifier: "all", expression: "done", outcome: TaskState.Done },
	{ id: "1", enabled: true, quantifier: "all", expression: "cancelled", outcome: TaskState.Cancelled },
	{ id: "2", enabled: true, quantifier: "all", expression: "forwarded", outcome: TaskState.Forwarded },
	{ id: "3", enabled: true, quantifier: "all", expression: "todo", outcome: TaskState.Todo },
	{ id: "4", enabled: true, quantifier: "all", expression: "scheduling", outcome: TaskState.InProgress },
	{
		id: "5",
		enabled: true,
		quantifier: "all",
		expression: "done or cancelled or forwarded",
		outcome: TaskState.Done
	},
	{
		id: "6",
		enabled: true,
		quantifier: "any",
		expression: "not (cancelled or forwarded)",
		outcome: TaskState.InProgress
	}
];
