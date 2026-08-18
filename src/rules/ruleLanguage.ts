import { TaskState } from "../taskState";
import { ParentRule } from "./ruleTypes";

type ExprNode =
	| { type: "atom"; state: TaskState }
	| { type: "not"; node: ExprNode }
	| { type: "and"; left: ExprNode; right: ExprNode }
	| { type: "or"; left: ExprNode; right: ExprNode };

export type CompiledExpression = { ast: ExprNode } | { error: string };

const STATE_ALIASES: Record<string, TaskState> = {
	todo: TaskState.Todo,
	done: TaskState.Done,
	cancelled: TaskState.Cancelled,
	canceled: TaskState.Cancelled,
	forwarded: TaskState.Forwarded,
	"in-progress": TaskState.InProgress,
	inprogress: TaskState.InProgress,
	in_progress: TaskState.InProgress,
	scheduling: TaskState.Scheduling,
	scheduled: TaskState.Scheduling
};

function tokenize(expression: string): string[] {
	return expression.match(/\(|\)|[^\s()]+/g) ?? [];
}

class Parser {
	private pos = 0;

	constructor(private readonly tokens: string[]) {}

	parseExpr(): ExprNode {
		let left = this.parseTerm();

		for (;;) {
			const lower = this.tokens[this.pos]?.toLowerCase();

			if (lower !== "and" && lower !== "or") break;

			this.pos += 1;
			const right = this.parseTerm();
			left = lower === "and" ? { type: "and", left, right } : { type: "or", left, right };
		}

		return left;
	}

	parseTerm(): ExprNode {
		if (this.tokens[this.pos]?.toLowerCase() === "not") {
			this.pos += 1;
			return { type: "not", node: this.parseTerm() };
		}

		return this.parseAtom();
	}

	parseAtom(): ExprNode {
		const token = this.tokens[this.pos];
		this.pos += 1;

		if (token === undefined) {
			throw new Error("unexpected end of expression");
		}

		if (token === "(") {
			const node = this.parseExpr();

			if (this.tokens[this.pos] !== ")") {
				throw new Error("expected closing parenthesis");
			}

			this.pos += 1;
			return node;
		}

		if (token === ")") {
			throw new Error("unexpected closing parenthesis");
		}

		const state = STATE_ALIASES[token.toLowerCase()];

		if (state === undefined) {
			throw new Error(`unknown status "${token}"`);
		}

		return { type: "atom", state };
	}

	atEnd(): boolean {
		return this.pos >= this.tokens.length;
	}
}

export function compileExpression(expression: string): CompiledExpression {
	const tokens = tokenize(expression);

	if (tokens.length === 0) {
		return { error: "expression is empty" };
	}

	const parser = new Parser(tokens);

	try {
		const ast = parser.parseExpr();

		if (!parser.atEnd()) {
			return { error: "unexpected trailing tokens" };
		}

		return { ast };
	} catch (err) {
		return { error: err instanceof Error ? err.message : "invalid expression" };
	}
}

function evalNode(node: ExprNode, state: TaskState): boolean {
	switch (node.type) {
		case "atom":
			return node.state === state;
		case "not":
			return !evalNode(node.node, state);
		case "and":
			return evalNode(node.left, state) && evalNode(node.right, state);
		case "or":
			return evalNode(node.left, state) || evalNode(node.right, state);
	}
}

export function ruleMatches(
	rule: ParentRule,
	compiled: CompiledExpression,
	childStates: TaskState[]
): boolean {
	if ("error" in compiled) return false;

	return rule.quantifier === "all"
		? childStates.every((state) => evalNode(compiled.ast, state))
		: childStates.some((state) => evalNode(compiled.ast, state));
}
