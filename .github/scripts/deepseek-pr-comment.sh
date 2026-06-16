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
        content: "You are a code review assistant for berry-pi-agent. Return actionable review notes only. Do not claim you ran tests. Prefer concise Korean when the PR text is Korean."
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
