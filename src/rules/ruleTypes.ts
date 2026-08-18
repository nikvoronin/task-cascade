import { TaskState } from "../taskState";

export type RuleQuantifier = "all" | "any";

export interface ParentRule {
	id: string;
	enabled: boolean;
	quantifier: RuleQuantifier;
	expression: string;
	outcome: TaskState;
}
