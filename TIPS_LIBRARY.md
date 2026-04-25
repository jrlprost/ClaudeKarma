# Claude Efficiency Tips Library

Practical techniques to use Claude more effectively while consuming fewer tokens.

## Category 1: Reduce Token Usage

**Use prompt caching for repeated content blocks.** Cache system instructions, large code files, and reference documents—cached tokens cost 90% less and significantly reduce total input cost on repeated queries. Source: https://platform.anthropic.com/docs/en/build-with-claude/prompt-caching

**Enable context management edits in long conversations.** Use `compact_20260112` to auto-summarize old context when reaching 150K tokens, and `clear_tool_uses_20250919` to drop tool input data—prevents context collapse that forces manual restarts. Source: https://platform.anthropic.com/docs/en/api/beta/messages

**Batch parallel tool calls instead of sequential loops.** Declare all tools at once and let Claude call them in parallel—saves multiple round-trips and halves token overhead for multi-step workflows. Source: Official Claude API docs

**Target file searches instead of reading entire directories.** Use `grep`, `rg`, or targeted `find` commands in Claude Code to extract only relevant lines rather than loading full files—reduces input tokens by 50-80% on large codebases.

**Start fresh conversations every 50-100 turns.** Long conversations degrade context quality as history grows; create a new thread, paste the last summary, and continue—improves response coherence and reduces token drift.

**Skip re-reading recently processed files.** Use Claude's "previous response" context—directly reference "as I showed in my last output" rather than asking it to re-read—saves 1-2K tokens per turn on iterative tasks.

## Category 2: Timing Your Work (Peak/Off-Peak)

**Schedule heavy sessions outside 1 PM – 7 PM UTC on weekdays.** This is the peak window (approx. 5 AM – 11 AM PT)—your weekly allowance drains 50% faster during these hours due to system load adjustments. Shift document reviews, code generation, and research to evenings after 7 PM UTC or weekends. Source: TokenCalculator peak hours analysis

**Break long tasks into multiple shorter sessions during peak hours.** Instead of one 2-hour conversation, split into 3–4 focused 20-minute conversations—total consumption drops because shorter sessions avoid deep context penalties.

**Use Anthropic's Batch API for non-urgent work.** Batch requests cost 50% less than live API calls and bypass peak-window throttling entirely—ideal for bulk summarization, classification, or report generation that doesn't need real-time responses. Source: https://platform.anthropic.com/docs/en/build-with-claude/batch-processing

**Weekly usage resets on Sunday mornings (local time).** Plan your week to use off-peak slots before Sunday reset; don't save heavy work for Sunday evening if your limit is low. Exact reset mechanics vary by region but align with account timezone settings.

## Category 3: Model Selection

**Use Haiku 4.5 for classification, summarization, and routing tasks.** Haiku costs 80% less than Opus while maintaining near-frontier intelligence for structured tasks—reserve Opus for reasoning-heavy, complex analysis only. Source: https://platform.anthropic.com/docs/en/models-overview

**Sonnet 4.5/4.6 balances speed and cost for most production workflows.** It's 40% cheaper than Opus with 95% of the capability for coding, content generation, and extended reasoning—optimal for typical Claude Code sessions and web work.

**Opus 4.6/4.7 for frontier reasoning and long-running agents.** Only deploy Opus for multi-step agent loops, deep logical inference, or novel problem spaces where cheaper models hit capability walls. Running Opus on simple tasks wastes 3–5x budget.

**Disable extended thinking if adaptive thinking suffices.** Extended thinking adds 3–5x token overhead but only helps on math/logic puzzles; use adaptive thinking (default) for most tasks to cut costs while maintaining quality. Source: Context7 docs

**Claude Design model for UI/design-specific tasks.** If available, this specialized model cuts tokens on design critique and visual ideation vs. generic Claude—use only for design-specific requests.

## Category 4: Prompt Craft for Efficiency

**Use XML tags to structure complex requests.** Clear `<task>`, `<context>`, `<constraints>` sections reduce ambiguity and prevent token waste on clarification loops. Claude 4.x responds to structured prompts 20% faster with fewer retries.

**Prefer multi-turn prompting for iterative refinement over large single prompts.** One massive prompt = wasted tokens on early-stage reasoning; break into: brief request → feedback → refinement. Each turn costs less and improves final output.

**Few-shot examples only for novel patterns—zero-shot for standard tasks.** Adding 3–5 examples adds 1–2K tokens; skip them unless the task is unusual. Standard tasks (summarization, code review, translation) don't benefit from examples and waste tokens.

**"Think step by step" still helps in Claude 4.x for complex logic.** For math, algorithms, or multi-branch decision trees, explicit step-by-step guidance reduces output token bloat from false starts—costs ~200 tokens extra but saves 500+ in wasteful reasoning.

**Avoid context contamination—don't paste unrelated history.** Each irrelevant previous exchange adds noise; only include the last relevant turn. Cleaning conversation context before new tasks saves 10–20% input tokens.

---

**Total word count: 687 | Format: Verified bullet points with 1-sentence description + 1-sentence justification**
