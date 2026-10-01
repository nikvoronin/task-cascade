export enum TaskState {
	Todo = "todo",
	Done = "done",
	Cancelled = "cancelled",
	Forwarded = "forwarded",
	InProgress = "in-progress",
	Scheduling = "scheduling"
}

export const IGNORE_UNKNOWN_CHECKBOX = "ignore";

// What a checkbox with an unrecognized status counts as: a state, or nothing at all.
export type TaskStateWithPolicy = TaskState | typeof IGNORE_UNKNOWN_CHECKBOX;
