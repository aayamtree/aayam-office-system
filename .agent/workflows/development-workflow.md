---
description: Standard development workflow for all changes — plan, verify, document
---

# Development Workflow

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Self-Improvement Loop
- After ANY correction from the user: update `.agent/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
// turbo-all
- Review lessons at session start for relevant project

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 4. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 6. Collect Feedback First
- When user says "this is 1/3" or indicates multiple items, WAIT for ALL items
- Batch fixes together — don't implement piecemeal
- Ask clarifying questions if needed, but batch them

## Task Management

1. **Plan First**: Write plan to `task.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `task.md`
6. **Capture Lessons**: Update `.agent/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Audit Before Fixing**: Grep the whole app for the pattern first, fix ALL at once.
- **Verify DB Schema**: Always check actual table creation SQL before using FK joins or assuming schema.

## Pre-Implementation Checklist

- [ ] Read `.agent/lessons.md` for relevant rules
- [ ] Is this pattern used elsewhere? → Grep first
- [ ] Does admin still see the resource after assignment?
- [ ] Are FK joins verified against actual DB schema?
- [ ] Will the user know WHO created/assigned this item?
- [ ] Am I making an ad-hoc fix? → Audit system-wide instead
- [ ] Is the sidebar data lightweight enough?
