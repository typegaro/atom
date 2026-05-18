export const BASH_TOOL_DESCRIPTION = `Run a shell command in zsh inside the workspace root. Use this when shell
execution is the right tool for the job and return the command output with its
exit code.`;

export const EDIT_TOOL_DESCRIPTION = `Edit an existing UTF-8 text file by replacing one exact text match. Read the
file first so \`oldText\` is exact. Make \`oldText\` specific enough to match only
one location.`;

export const GLOB_TOOL_DESCRIPTION = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead
- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.`;

export const GREP_TOOL_DESCRIPTION = `- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\s+\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths and line numbers with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
- If you need to identify/count the number of matches within files, use the Bash tool with \`rg\` (ripgrep) directly. Do NOT use \`grep\`.
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead`;

export const LOAD_SKILL_TOOL_DESCRIPTION = `Activate a skill by its exact name and load its full instructions into the
conversation before proceeding with a task that matches that skill.`;

export const READ_TOOL_DESCRIPTION = `Read a specific range of lines from a UTF-8 text file. Always specify \`offset\`
and \`limit\`. Prefer small reads first, then continue with a later offset as
needed. Do not use this for binary files.`;

export const WRITE_TOOL_DESCRIPTION = `Write UTF-8 text to a file, replacing its full contents. Use this for new files
or full rewrites rather than targeted edits to existing files.`;
