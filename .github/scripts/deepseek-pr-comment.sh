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
SYSTEM_CONTENT="$(agent_pr_review_system_prompt)"

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
diff_truncated=0
if [[ "${diff_chars}" -gt "${MAX_DIFF_CHARS}" ]]; then
  diff_truncated=1
fi

diff_metadata="$(agent_pr_diff_metadata "${diff_file}" "${MAX_DIFF_CHARS}" "${REPO}" "${PR_NUMBER}")"

surrounding_context="$(agent_pr_surrounding_context "${REPO}" "${PR_NUMBER}" "${SURROUNDING_CONTEXT_LINES:-25}" "${SURROUNDING_CONTEXT_MAX_FILES:-4}" "${SURROUNDING_CONTEXT_MAX_CHARS:-14000}")"

ci_checks="$(gh pr checks "${PR_NUMBER}" --repo "${REPO}" 2>/dev/null | head -20 || echo "unavailable")"

failed_ci_logs="$(agent_pr_failed_ci_logs "${REPO}" "${PR_NUMBER}" "${FAILED_CI_LOG_MAX_CHARS:-8000}")"

user_content="$(cat <<EOF
Repository: ${REPO}
Pull request #${PR_NUMBER}: ${TITLE}

PR body:
${BODY}

Additional request:
${EXTRA}

${diff_metadata}

${surrounding_context}

Review the PR diff for correctness, regression risk, security/privacy issues, workflow reliability, and missing tests.

Latest CI checks (informational; do not claim you ran them):
${ci_checks}

${failed_ci_logs}

Diff:
${diff_text}
EOF
)"

agent_deepseek_write_payload "${payload_file}" "${MODEL}" "${SYSTEM_CONTENT}" "${user_content}" "0.2"

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

agent_log_deepseek_usage "${response_file}"

comment_body="$(jq -r '.choices[0].message.content // empty' "${response_file}")"
if [[ -z "${comment_body}" ]]; then
  echo "Empty model response" >&2
  cat "${response_file}" >&2
  exit 1
fi

comment_body="$(agent_post_process_review_comment "${comment_body}" "${diff_truncated}")"

{
  echo "${comment_body}"
  agent_footer "${WORKFLOW_ID}" "${MODEL}"
} > "${response_file}"

gh api \
  "repos/${REPO}/issues/${PR_NUMBER}/comments" \
  -f body="$(cat "${response_file}")"

agent_apply_labels "${PR_NUMBER}" "agent:reviewed"

echo "Posted DeepSeek PR review comment on PR #${PR_NUMBER}"
