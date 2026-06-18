#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-lib.sh
source "${SCRIPT_DIR}/agent-lib.sh"

PR_NUMBER="${1:?PR number required}"
TITLE="${2:-}"
BODY="${3:-}"
EXTRA="${4:-}"
MODEL="${DEEPSEEK_MODEL:-deepseek-v4-flash}"
REPO="${GITHUB_REPOSITORY:?}"
WORKFLOW_ID="deepseek-pr-review"
MAX_DIFF_CHARS="${MAX_DIFF_CHARS:-60000}"
OUTPUT_SECTIONS="$(agent_output_sections_prompt)"
PR_REVIEW_INSTRUCTIONS="$(cat <<'EOF'
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
)"

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "DEEPSEEK_API_KEY is not set" >&2
  exit 1
fi

diff_file="$(mktemp)"
payload_file="$(mktemp)"
response_file="$(mktemp)"
trap 'rm -f "${diff_file}" "${payload_file}" "${response_file}"' EXIT

gh api \
  -H "Accept: application/vnd.github.v3.diff" \
  "repos/${REPO}/pulls/${PR_NUMBER}" > "${diff_file}"

diff_text="$(head -c "${MAX_DIFF_CHARS}" "${diff_file}")"
diff_chars="$(wc -c < "${diff_file}" | tr -d ' ')"
truncated_note=""
if [[ "${diff_chars}" -gt "${MAX_DIFF_CHARS}" ]]; then
  truncated_note="Diff was truncated to ${MAX_DIFF_CHARS} characters from ${diff_chars} total characters."
fi

user_content="$(cat <<EOF
Repository: ${REPO}
Pull request #${PR_NUMBER}: ${TITLE}

PR body:
${BODY}

Additional request:
${EXTRA}

${truncated_note}

Review the PR diff for correctness, regression risk, security/privacy issues, workflow reliability, and missing tests.

${PR_REVIEW_INSTRUCTIONS}

${OUTPUT_SECTIONS}

Diff:
${diff_text}
EOF
)"

jq -n \
  --arg model "${MODEL}" \
  --arg user "${user_content}" \
  '{
    model: $model,
    stream: false,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "You are a strict diff review assistant for berry-pi-agent. Lead with actionable bugs and risks grounded in the provided diff. Do not claim you ran tests. Prefer concise Korean when the PR text is Korean."
      },
      {role: "user", content: $user}
    ]
  }' > "${payload_file}"

http_code="$(curl -sS -o "${response_file}" -w "%{http_code}" \
  https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  --data-binary @"${payload_file}")"

if [[ "${http_code}" != "200" ]]; then
  echo "DeepSeek API HTTP ${http_code}" >&2
  cat "${response_file}" >&2
  exit 1
fi

comment_body="$(jq -r '.choices[0].message.content // empty' "${response_file}")"
if [[ -z "${comment_body}" ]]; then
  echo "Empty model response" >&2
  cat "${response_file}" >&2
  exit 1
fi

{
  echo "${comment_body}"
  agent_footer "${WORKFLOW_ID}" "${MODEL}"
} > "${response_file}"

gh api \
  "repos/${REPO}/issues/${PR_NUMBER}/comments" \
  -f body="$(cat "${response_file}")"

agent_apply_labels "${PR_NUMBER}" "agent:reviewed"

echo "Posted DeepSeek PR review comment on PR #${PR_NUMBER}"
