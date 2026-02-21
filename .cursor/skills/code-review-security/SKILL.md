---
name: code-review-security
description: Reviews code changes for security vulnerabilities, bad practices, and code smells. Identifies issues with severity levels and applies fixes only after explicit user confirmation. Use when reviewing pull requests, examining diffs, or when the user asks for security review, code quality check, or to find potential improvements.
---

# Code Review: Security, Practices & Improvements

## Workflow

**Two-phase process — never fix without confirmation:**

1. **Analyze** — Review changes for issues
2. **Report** — Present findings with severity and suggested fixes
3. **Wait** — Stop and ask: "Should I apply these fixes?"
4. **Fix** — Only after user confirms (e.g. "yes", "apply", "fix the critical ones")

## What to Check

### Security
- **Injection**: SQL, command, path traversal, XSS
- **Auth/authz**: Hardcoded secrets, missing validation, IDOR
- **Input validation**: Unsanitized user input, prototype pollution
- **Sensitive data**: Logging secrets, exposure in errors

### Bad Practices
- `eval()` / `new Function()` with user input
- Unsafe `dangerouslySetInnerHTML` without sanitization
- Path concatenation without validation (traversal risk)
- Raw string concatenation in SQL
- Missing error handling on async/await

### Code Smells
- Duplicated logic, magic numbers, deep nesting
- Overly broad `catch` blocks, ignored errors
- Missing null/undefined checks on user-controlled data

## Severity Levels

| Level | Meaning | Example |
|-------|---------|---------|
| **Critical** | Security or correctness; fix before merge | SQL injection, XSS |
| **High** | Likely bug or security risk | Unvalidated path, leaked secret |
| **Medium** | Bad practice, maintainability | Missing error handling |
| **Low** | Suggestion, nice-to-have | Magic number, minor duplication |

## Report Format

```markdown
## Code Review Findings

### Critical
- **[Location]**: [Issue]. Fix: [brief suggestion]

### High
- ...

### Medium / Low
- ...
```

## Rules

1. **Never apply fixes without explicit confirmation** — Always ask first
2. **Be specific** — Cite file:line and exact code when possible
3. **One finding per issue** — Don't group unrelated problems
4. **Suggest concrete fixes** — Not just "improve this"
5. **Acknowledge good patterns** — Note what's done well when relevant

## Confirmation Phrasing

After reporting, use one of:

- "Should I apply these fixes?"
- "I can fix the [Critical/High] issues if you confirm."
- "Reply 'apply' or 'fix' to have me implement the suggested changes."
