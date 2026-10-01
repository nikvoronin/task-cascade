import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["node_modules", "main.js", "esbuild.config.mjs", "eslint.config.mjs"]),
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			globals: globals.browser,
			parser: tseslint.parser,
			parserOptions: { project: "./tsconfig.json" }
		}
	}
]);
