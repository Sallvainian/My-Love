# TEA Step-File Architecture

## Overview

The TEA Step-File Architecture document (v1.0, dated 2026-01-27) explains how to structure workflows for maximum LLM compliance and consistency.

## Core Problem & Solution

**The Problem**: Traditional workflow instructions suffer from context overload, causing LLMs to improvise or skip steps rather than follow instructions precisely.

**The Solution**: Step files break workflows into "granular, self-contained instruction units" where each step contains exactly one clear action with explicit exit conditions.

## Key Principles

The architecture rests on five foundational principles:

1. **Just-In-Time Loading**: Only load the current step file; never load all steps simultaneously
2. **Context Injection**: Each step repeats necessary background information without assuming LLM memory
3. **Explicit Exit Conditions**: Steps clearly state when proceeding to the next step is permitted
4. **Strict Action Boundaries**: Steps explicitly forbid actions outside their scope
5. **Subprocess Support**: Independent steps can run in parallel subprocesses

## Five Workflow Patterns

The document identifies five architectural patterns:

- **Pattern 1 (Sequential Steps)**: Used for simple, dependent workflows like framework setup
- **Pattern 2 (Parallel Generation)**: Used for test automation where API and E2E tests generate independently
- **Pattern 3 (Parallel Validation)**: Quality workflows running concurrent checks (60-70% performance gain)
- **Pattern 4 (Two-Phase)**: Dependency workflows with distinct phases (e.g., generate then apply logic)
- **Pattern 5 (Risk-Based Planning)**: Sequential assessment workflow for test design

## Standard Step File Structure

Every step follows this template:

- Context (from previous steps)
- Your Task (Step N Only)
- Requirements (checklist)
- What You MUST Do (actions)
- What You MUST NOT Do (boundaries)
- Exit Condition (completion criteria)
- Next Step (pointer to subsequent file)

## Knowledge Fragment Integration

Step files explicitly load knowledge fragments from `{project-root}/_bmad/tea/testarch/knowledge/` and enforce their usage patterns. Fragment loading instructions appear early; usage is mandatory rather than optional.

## Performance Benefits

The document reports significant execution improvements:

- automate workflow: 50% faster (~5 minutes vs 10 minutes)
- test-review: 60% faster (~2 minutes vs 5 minutes)
- nfr-assess: 67% faster (~4 minutes vs 12 minutes)

## Validation & Testing

All 9 TEA workflows achieve 100% LLM compliance through BMad Builder validation and real-project testing with zero improvisation issues reported.

## Maintenance Guidelines

Step files should remain 200-500 words (not 2000+), repeat context liberally, use explicit language ("3-5 test cases" not "some tests"), and list forbidden actions explicitly.

## Anti-Patterns to Avoid

The document warns against oversized steps, vague instructions, missing exit conditions, assumed knowledge, and combining multiple tasks per step.
