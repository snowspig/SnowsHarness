## Code Review Standards

When reviewing code, classify every finding by severity:

- **Blocker**: Will cause failures in production (security holes, data loss, crashes)
- **High**: Likely to cause problems soon (race conditions, missing error handling)
- **Medium**: Should be fixed but not urgent (code smells, missing tests, naming)
- **Nitpick**: Style preferences, minor readability improvements

Every finding must include: file path, line number, what's wrong, why it matters,
and a suggested fix. No finding without evidence.
