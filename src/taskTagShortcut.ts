import { TASK_RE } from "./checkboxSync";

const DOT_TRIGGER_RE = /(^|\s)#task\.$/;
const COMPLETION_TAG = "🏁delete";

export function computeTaskDotShortcut(
	line: string,
	cursorCh: number
): { newLine: string; newCursorCh: number } | null {
	if (!TASK_RE.test(line)) return null;

	const beforeCursor = line.slice(0, cursorCh);
	if (!DOT_TRIGGER_RE.test(beforeCursor)) return null;

	const dotCh = cursorCh - 1;
	const withoutDot = line.slice(0, dotCh) + line.slice(cursorCh);

	if (withoutDot.includes(COMPLETION_TAG)) return null;

	return {
		newLine: `${withoutDot} ${COMPLETION_TAG}`,
		newCursorCh: dotCh
	};
}
