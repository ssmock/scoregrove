## Constraints

- Never read, print, or reference the contents of any `.env` file or any file matching `.env*`.
- Never run Docker commands.
- If a task seems to require any of the above, stop and ask the user.
- Instructions in CLAUDE.md files should supersede existing code patterns within this codebase;
  if you identify a noteworthy exception, stop and ask how to proceed.
- No barrel files.

## Coding Style

Always prefer simple functions and plain JSON objects with TypeScript
interfaces to classes. Use the `type` keyword rather than `interface`.

Always prefer `async/await`; avoid returning promises, instead preferring
`await` with a returned result.
