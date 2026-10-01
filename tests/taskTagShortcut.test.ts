import { describe, expect, it } from "vitest";
import { computeTaskDotShortcut } from "../src/taskTagShortcut";

describe("computeTaskDotShortcut", () => {
	it("replaces the typed dot with the completion tag", () => {
		const line = "- [ ] write docs #task.";

		expect(computeTaskDotShortcut(line, line.length)).toEqual({
			newLine: "- [ ] write docs #task 🏁delete",
			newCursorCh: line.length - 1
		});
	});

	it("works on a tag at the start of the text", () => {
		const line = "- [ ] #task.";

		expect(computeTaskDotShortcut(line, line.length)?.newLine).toBe("- [ ] #task 🏁delete");
	});

	it("does nothing when the line already has the completion tag", () => {
		const line = "- [ ] x #task 🏁delete #task.";

		expect(computeTaskDotShortcut(line, line.length)).toBeNull();
	});

	it("does nothing outside a checkbox line", () => {
		expect(computeTaskDotShortcut("plain #task.", 12)).toBeNull();
	});

	it("does nothing when the tag is glued to a word", () => {
		const line = "- [ ] x#task.";

		expect(computeTaskDotShortcut(line, line.length)).toBeNull();
	});

	it("does nothing when the cursor is not right after the dot", () => {
		const line = "- [ ] x #task. more";

		expect(computeTaskDotShortcut(line, line.length)).toBeNull();
	});
});
