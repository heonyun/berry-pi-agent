#!/usr/bin/env bash
# Shared helpers for pi-agent GitHub automation scripts.

AGENT_MARKER_PREFIX='<!-- pi-agent:workflow:'
AGENT_ANTIGRAVITY_MARKER='<!-- pi-agent:created-by:antigravity -->'

agent_footer() {
  local workflow_id="${1:?workflow id required}"
  local model="${2:-deepseek-v4-flash}"
  echo ""
  echo "---"
  echo "${AGENT_MARKER_PREFIX}${workflow_id} -->"
  echo "_Automated note via DeepSeek (${model}) · workflow: ${workflow_id}_"
}

agent_output_sections_prompt() {
  cat <<'EOF'
Return markdown with exactly these sections (in this order):
## Conclusion
pass | hold | fail

## Summary

## Findings
1. ...

## Suggested next steps

## Commands to rerun
Use concrete shell commands, or "none" if not applicable.

Do not include a footer, HTML comments, or workflow markers; the script appends those automatically.
EOF
}

agent_issue_review_instructions() {
  cat <<'EOF'
Act as a pre-implementation reviewer, not a cheerleader or summary bot.

Do not merely approve, restate, or summarize the issue. Your job is to reduce
implementation risk before a human or Codex writes code.

Review requirements this way:
- Identify missing design decisions, incorrect assumptions, event-flow risks,
  state-management risks, and likely test gaps.
- Ground every substantive finding in the repository shape. When the issue
  names files, functions, frameworks, commands, or paths, reason from those
  concrete references.
- If the issue is about a known area and you can infer likely files, name the
  likely files/functions to inspect or change. If you cannot verify a claim
  from the issue text alone, say what must be inspected before implementation.
- Prefer "hold" when important implementation choices are still unresolved,
  when a prototype is needed, or when the issue contains assumptions that may
  be wrong. Do not default to "Needs design decision" when the issue already
  names a concrete root cause, affected files, and a smallest safe fix; in that
  case recommend implementing the smallest fix first and list only genuine
  open product choices.
- Use P0/P1/P2/P3 severity labels for actionable findings (same scale as PR
  review). Do not use high/medium/low instead.
- When the issue cites specific files, functions, or commands, reuse those
  exact names. Do not write "file unknown" if the issue already names the path.
- Do not claim you ran tests or inspected files unless the issue text includes
  that evidence. You only have the issue context provided in this prompt.
- Use commands that match the repository scripts/package manager shown in the
  issue. If unsure, say to inspect package.json rather than inventing commands.

Include these points inside the required sections:
- In Summary: add "Implementation readiness: Ready now | Needs design decision
  | Needs prototype | Too ambiguous".
- In Findings: for each important finding include P0/P1/P2/P3 severity,
  affected area or likely file/function named in the issue, why it matters,
  concrete recommendation, and needed verification.
- Do not list confirmations or praise as findings.
- In Suggested next steps: order the smallest safe patch/prototype first.
- In Commands to rerun: prefer exact workspace commands from the issue body
  (for example `npm run test --workspace=@berry-pi/context-canvas`). If unsure,
  write "inspect package.json for the exact workspace command" instead of
  inventing jest/vitest flags such as `--testPathPattern`.
EOF
}

agent_pr_review_instructions() {
  cat <<'EOF'
Act as a strict diff reviewer, not a summary bot.

Review only the provided PR diff and PR context. Do not invent repository facts
outside the diff. If a risk requires non-diff context, mark it as "needs
verification" instead of stating it as fact.

Review requirements:
- Prioritize correctness bugs, behavioral regressions, security/privacy issues,
  workflow reliability problems, and missing tests.
- Every actionable finding must include severity (P0/P1/P2/P3), affected file
  and line or hunk when available, why it matters, and a concrete fix direction.
- Every actionable finding must include an "Evidence" sentence that cites the
  exact diff hunk, file/line, or quoted code fragment that proves the issue is
  present in the current PR. If you cannot cite current-code evidence, move it
  to residual risk or "needs verification" instead of Findings.
- On re-review requests, treat previous review comments as stale until the
  current diff proves the issue still exists. Do not repeat an earlier finding
  just because it appeared in a previous response.
- Do not claim a value is random, dynamic, unprotected, missing, or unused unless
  the current diff or provided context contains code evidence for that claim.
- Do not produce generic praise, restatements of the PR, or broad style advice
  unless it points to a real bug or maintainability risk in the diff.
- Use "fail" for blockers or likely correctness/security regressions, "hold"
  for important unresolved risk or missing verification, and "pass" only when
  there are no actionable findings.
- Before using "fail" or "hold", verify that Findings contains at least one
  current actionable issue backed by evidence. Future-only design limitations
  and nice-to-have tests are not merge blockers by themselves.
- Do not list confirmations, praise, or already-correct behavior as findings.
  Findings must be problems, risks, or verification gaps only.
- Keep non-blocking follow-ups separate from Findings under residual risks or
  Suggested next steps, and state that they are not blockers.
- Do not claim you ran tests.
- In "Commands to rerun", suggest only commands supported by the PR context or
  repository scripts visible in the PR body/diff. If unsure, write "inspect
  package.json for the exact workspace command" instead of inventing package
  manager commands.

If there are no actionable findings, say so explicitly in Findings and include
remaining test gaps or residual risks.
EOF
}

agent_ci_explain_instructions() {
  cat <<'EOF'
Analyze the failed CI logs provided in the user message. Identify the failing
step/command, likely root cause, suspect files, and concrete rerun commands.

Set Conclusion to fail.
EOF
}

# Stable system prompt for issue planning/review (prefix-friendly for DeepSeek cache).
agent_issue_review_system_prompt() {
  cat <<EOF
You are a pre-implementation review assistant for berry-pi-agent, the pi-agent repository. Find design gaps, implementation risks, incorrect assumptions, and verification needs before work starts. Be concise, concrete, and structured. Prefer concise Korean when the issue text is Korean.

$(agent_issue_review_instructions)

$(agent_output_sections_prompt)
EOF
}

# Stable system prompt for PR diff review.
agent_pr_review_system_prompt() {
  cat <<EOF
You are a strict diff review assistant for berry-pi-agent. Lead with actionable bugs and risks grounded in the provided diff. Do not claim you ran tests. Prefer concise Korean when the PR text is Korean.

$(agent_pr_review_instructions)

$(agent_output_sections_prompt)
EOF
}

# Stable system prompt for CI failure analysis.
agent_ci_explain_system_prompt() {
  cat <<EOF
You are a CI failure analysis assistant for berry-pi-agent. Base findings on the provided logs only. Do not claim you ran commands. Prefer concise Korean when surrounding context is Korean.

$(agent_ci_explain_instructions)

$(agent_output_sections_prompt)
EOF
}

# Log DeepSeek prompt cache usage from a chat/completions response JSON file.
agent_log_deepseek_usage() {
  local response_file="${1:?response file required}"
  jq -r '.usage | "DeepSeek usage: cache_hit=\(.prompt_cache_hit_tokens // 0) cache_miss=\(.prompt_cache_miss_tokens // 0) prompt=\(.prompt_tokens // 0) completion=\(.completion_tokens // 0)"' \
    "${response_file}"
}

# Exit 0 when the issue body was created or delegated via Antigravity CLI.
agent_issue_has_antigravity_marker() {
  local body="${1:-}"
  [[ "${body}" == *"${AGENT_ANTIGRAVITY_MARKER}"* ]]
}

# Exit 0 when an opened/reopened issue should receive automatic planning.
# Args: issue_author issue_association issue_body
agent_issue_eligible_for_auto_plan() {
  local author="${1:-}"
  local association="${2:-}"
  local body="${3:-}"

  if agent_issue_has_antigravity_marker "${body}"; then
    return 0
  fi

  if [[ "${author}" == *"[bot]" ]] || [[ "${author}" == "dependabot[bot]" ]]; then
    return 1
  fi

  if [[ "${association}" =~ ^(OWNER|MEMBER|COLLABORATOR)$ ]]; then
    return 0
  fi

  return 1
}

# Exit 0 when the comment should be skipped (bot or agent marker present).
# Exit 1 when the comment should be processed.
agent_should_skip_comment() {
  local actor="${1:-}"
  local body="${2:-}"

  if [[ "${actor}" == "github-actions[bot]" ]] || [[ "${actor}" == *"[bot]" ]]; then
    return 0
  fi

  if [[ "${body}" == *"${AGENT_MARKER_PREFIX}"* ]]; then
    return 0
  fi

  return 1
}

# Prints the additional context for supported issue assistant commands.
# Exit 0 when the comment invokes the issue assistant, otherwise exit 1.
agent_issue_assistant_context_from_comment() {
  local body="${1:-}"

  case "${body}" in
    /deepseek*)
      local context="${body#/deepseek}"
      echo "${context# }"
      return 0
      ;;
    @deepseek*)
      local context="${body#@deepseek}"
      echo "${context# }"
      return 0
      ;;
    @github-actions*)
      local context="${body#@github-actions}"
      echo "${context# }"
      return 0
      ;;
  esac

  return 1
}

agent_apply_labels() {
  local issue_number="${1:?issue number required}"
  shift
  local repo="${GITHUB_REPOSITORY:?}"

  if [[ $# -eq 0 ]]; then
    return 0
  fi

  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not available; skipping labels" >&2
    return 0
  fi

  local labels_json
  labels_json="$(printf '%s\n' "$@" | jq -R . | jq -s '{labels: .}')"

  if ! gh api \
    -X POST \
    "repos/${repo}/issues/${issue_number}/labels" \
    --input - <<<"${labels_json}" 2>/dev/null; then
    echo "Warning: failed to apply labels ($*) to #${issue_number}" >&2
  fi
}

agent_remove_label() {
  local issue_number="${1:?issue number required}"
  local label="${2:?label required}"
  local repo="${GITHUB_REPOSITORY:?}"

  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not available; skipping label removal" >&2
    return 0
  fi

  local encoded_label
  encoded_label="$(jq -rn --arg v "${label}" '$v|@uri')"

  if ! gh api \
    -X DELETE \
    "repos/${repo}/issues/${issue_number}/labels/${encoded_label}" 2>/dev/null; then
    echo "Warning: failed to remove label ${label} from #${issue_number}" >&2
  fi
}
