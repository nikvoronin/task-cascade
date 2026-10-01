import { describe, expect, it } from "vitest";
import { computeCheckboxEdits } from "../src/checkboxSync";
import { DEFAULT_RULES } from "../src/rules/defaultRules";
import { IGNORE_UNKNOWN_CHECKBOX } from "../src/taskState";

const TREE = "- [ ] p\n  - [x] c\n";

function editCount(doc: string): number {
	return computeCheckboxEdits(doc, DEFAULT_RULES, IGNORE_UNKNOWN_CHECKBOX).length;
}

describe("regions where checkboxes are not tasks", () => {
	it("cascades a plain task tree", () => {
		expect(editCount(TREE)).toBe(1);
		expect(editCount(TREE + "\n" + TREE)).toBe(2);
	});

	describe("fenced code", () => {
		it.each([
			["backticks", "```\n" + TREE + "```\n"],
			["tildes", "~~~\n" + TREE + "~~~\n"],
			["a fence with an info string", "```ts\n" + TREE + "```\n"],
			["a shorter fence inside a longer one", "````\n```\n" + TREE + "````\n"],
			["an unclosed fence", "```\n" + TREE],
			["a fence nested in a list item", "- [ ] a\n  ```\n  - [x] b\n  ```\n"],
			["children in code with the parent outside", "- [ ] p\n```\n  - [x] c\n```\n"]
		])("ignores %s", (_name, doc) => {
			expect(editCount(doc)).toBe(0);
		});

		it("resumes after the fence closes", () => {
			expect(editCount("```\nx\n```\n" + TREE)).toBe(1);
		});

		it("does not close on a fence of the other character", () => {
			expect(editCount("```\n~~~\n" + TREE + "```\n")).toBe(0);
		});

		it("treats a single-line ```code``` as inline code, not a fence", () => {
			expect(editCount("```code``` x\n" + TREE)).toBe(1);
		});
	});

	describe("quotes and callouts", () => {
		it("ignores tasks in a blockquote", () => {
			expect(editCount("> - [ ] p\n>   - [x] c\n")).toBe(0);
		});

		it("ignores tasks in a callout", () => {
			expect(editCount("> [!note]\n> - [ ] p\n>   - [x] c\n")).toBe(0);
		});
	});

	describe("frontmatter", () => {
		it("ignores a closed frontmatter block", () => {
			expect(editCount("---\n- [ ] p\n  - [x] c\n---\n" + TREE)).toBe(1);
		});

		it("accepts ... as the closing line", () => {
			expect(editCount("---\n- [ ] p\n  - [x] c\n...\n" + TREE)).toBe(1);
		});

		it("does not treat an unclosed leading --- as frontmatter", () => {
			expect(editCount("---\n" + TREE)).toBe(1);
		});

		it("only recognises frontmatter on the first line", () => {
			expect(editCount("text\n---\n" + TREE + "---\n")).toBe(1);
		});
	});

	describe("math and comments", () => {
		it.each([
			["$$ math", "$$\n" + TREE + "$$\n", "$$x$$\n"],
			["%% comment", "%%\n" + TREE + "%%\n", "%% note %%\n"],
			["html comment", "<!--\n" + TREE + "-->\n", "<!-- note -->\n"]
		])("ignores a multi-line %s", (_name, block, oneLiner) => {
			expect(editCount(block + TREE)).toBe(1);
			// A one-line form must not open a region.
			expect(editCount(oneLiner + TREE)).toBe(1);
		});

		it("keeps a task with an inline %% comment", () => {
			expect(editCount("- [ ] p %%note%%\n  - [x] c\n")).toBe(1);
		});
	});
});
