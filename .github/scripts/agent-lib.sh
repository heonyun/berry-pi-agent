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
