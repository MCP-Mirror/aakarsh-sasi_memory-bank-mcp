/**
 * Templates for the main Memory Bank files
 */

/**
 * Template for the product-context.md file
 */
export const productContextTemplate = `# Project Overview

## Description
[Project description]

## Objectives
- [Objective 1]
- [Objective 2]
- [Objective 3]

## Technologies
- [Technology 1]
- [Technology 2]
- [Technology 3]

## Architecture
[Architecture description]

## Project Structure
[Project structure description]
`;

/**
 * Template for the active-context.md file
 */
export const activeContextTemplate = `# Current Context

## Ongoing Tasks
- [Task 1]
- [Task 2]
- [Task 3]

## Known Issues
- [Issue 1]
- [Issue 2]

## Next Steps
- [Next step 1]
- [Next step 2]
- [Next step 3]

## Current Session Notes
- [Note 1]
- [Note 2]
`;

/**
 * Template for the progress.md file
 */
export const progressTemplate = `# Project Progress

## Completed Milestones
- [Milestone 1] - [Date]
- [Milestone 2] - [Date]

## Pending Milestones
- [Milestone 3] - [Expected date]
- [Milestone 4] - [Expected date]

## Update History
- [Date] - [Update]
- [Date] - [Update]
`;

/**
 * Template for the decision-log.md file
 */
export const decisionLogTemplate = `# Decision Log

## Decision 1
- **Date:** [Date]
- **Context:** [Context]
- **Decision:** [Decision]
- **Alternatives Considered:** [Alternatives]
- **Consequences:** [Consequences]

## Decision 2
- **Date:** [Date]
- **Context:** [Context]
- **Decision:** [Decision]
- **Alternatives Considered:** [Alternatives]
- **Consequences:** [Consequences]
`;

/**
 * Template for the system-patterns.md file
 */
export const systemPatternsTemplate = `# System Patterns

## Architecture Patterns
[Architecture patterns description]

## Code Patterns
[Code patterns description]

## Documentation Patterns
[Documentation patterns description]
`;

/**
 * Array with all main templates
 */
export const coreTemplates = [
  { name: 'product-context.md', content: productContextTemplate },
  { name: 'active-context.md', content: activeContextTemplate },
  { name: 'progress.md', content: progressTemplate },
  { name: 'decision-log.md', content: decisionLogTemplate },
  { name: 'system-patterns.md', content: systemPatternsTemplate },
];