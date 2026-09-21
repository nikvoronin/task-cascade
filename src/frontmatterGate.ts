import { App, TFile } from "obsidian";

export const TASK_CASCADE_ENABLE_KEY = "task-cascade-enable";

export function isTaskCascadeEnabledForFile(app: App, file: TFile | null): boolean {
	if (!file) return true;

	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatter?.[TASK_CASCADE_ENABLE_KEY] !== false;
}
