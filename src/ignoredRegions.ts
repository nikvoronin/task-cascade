type Region = "none" | "fence" | "math" | "comment" | "html-comment";

// Streams over a note's lines in order and reports the ones that sit inside a region
// where `- [ ]` is not a real task: fenced code, frontmatter, `$$` math, `%%` and `<!-- -->` comments.
export class RegionTracker {
	private region: Region = "none";
	private fenceChar = "";
	private fenceLength = 0;
	private readonly frontmatterEnd: number;

	constructor(lines: string[]) {
		this.frontmatterEnd = findFrontmatterEnd(lines);
	}

	isIgnored(line: string, lineNo: number): boolean {
		if (lineNo <= this.frontmatterEnd) return true;

		if (this.region !== "none") {
			if (this.closesRegion(line)) this.region = "none";
			return true;
		}

		const first = firstNonSpace(line);

		switch (line[first]) {
			case "`":
			case "~":
				return this.tryOpenFence(line, first);
			case "$":
				return this.tryOpenDelimited(line, first, "$$", "math");
			case "%":
				return this.tryOpenDelimited(line, first, "%%", "comment");
			case "<":
				return this.tryOpenHtmlComment(line, first);
			default:
				return false;
		}
	}

	private closesRegion(line: string): boolean {
		switch (this.region) {
			case "fence":
				return this.closesFence(line);
			case "math":
				return line.includes("$$");
			case "comment":
				return line.includes("%%");
			case "html-comment":
				return line.includes("-->");
			default:
				return false;
		}
	}

	private closesFence(line: string): boolean {
		const trimmed = line.trim();

		return (
			trimmed.length >= this.fenceLength &&
			trimmed[0] === this.fenceChar &&
			isRepeatedChar(trimmed, this.fenceChar)
		);
	}

	private tryOpenFence(line: string, first: number): boolean {
		const char = line[first]!;
		let end = first;

		while (line[end] === char) end++;

		const length = end - first;
		if (length < 3) return false;

		// A backtick fence's info string can't contain backticks: that's inline code, not a fence.
		if (char === "`" && line.includes("`", end)) return false;

		this.region = "fence";
		this.fenceChar = char;
		this.fenceLength = length;

		return true;
	}

	// Opens only when the line starts with the token and leaves it unbalanced (odd count).
	private tryOpenDelimited(line: string, first: number, token: string, region: Region): boolean {
		if (!line.startsWith(token, first)) return false;
		if (countOccurrences(line, token) % 2 === 0) return false;

		this.region = region;

		return true;
	}

	private tryOpenHtmlComment(line: string, first: number): boolean {
		if (!line.startsWith("<!--", first)) return false;
		if (line.lastIndexOf("<!--") < line.lastIndexOf("-->")) return false;

		this.region = "html-comment";

		return true;
	}
}

// Frontmatter only counts when it opens on the very first line and is actually closed.
function findFrontmatterEnd(lines: string[]): number {
	if (lines[0]?.trimEnd() !== "---") return -1;

	for (let i = 1; i < lines.length; i++) {
		const trimmed = lines[i]!.trimEnd();
		if (trimmed === "---" || trimmed === "...") return i;
	}

	return -1;
}

function firstNonSpace(line: string): number {
	let i = 0;

	while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;

	return i;
}

function isRepeatedChar(text: string, char: string): boolean {
	for (const c of text) {
		if (c !== char) return false;
	}

	return true;
}

function countOccurrences(text: string, token: string): number {
	let count = 0;
	let index = text.indexOf(token);

	while (index !== -1) {
		count++;
		index = text.indexOf(token, index + token.length);
	}

	return count;
}
