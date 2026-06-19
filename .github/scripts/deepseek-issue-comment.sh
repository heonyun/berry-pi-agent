#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-lib.sh
source "${SCRIPT_DIR}/agent-lib.sh"

MODE="${1:?mode required: plan|invoke}"
ISSUE_NUMBER="${2:?issue number required}"
TITLE="${3:-}"
BODY="${4:-}"
EXTRA="${5:-}"
MODEL="${DEEPSEEK_MODEL:-deepseek-v4-flash}"
REPO="${GITHUB_REPOSITORY:?}"
WORKFLOW_ID="deepseek-issue-assistant"
SYSTEM_CONTENT="$(agent_issue_review_system_prompt)"

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "DEEPSEEK_API_KEY is not set" >&2
  exit 1
fi

payload_file="$(mktemp)"
response_file="$(mktemp)"
trap 'rm -f "${payload_file}" "${response_file}"' EXIT

if [[ "${MODE}" == "plan" ]]; then
  user_content="$(cat <<EOF
Repository: ${REPO}
Issue #${ISSUE_NUMBER}: ${TITLE}

Issue body:
${BODY}

Post a planning review (no code implementation).

Reply in Korean when the issue body is mostly Korean.
EOF
)"
else
  user_content="$(cat <<EOF
Repository: ${REPO}
Issue #${ISSUE_NUMBER}: ${TITLE}

Issue body:
${BODY}

Follow-up request:
${EXTRA}

Reply as a pre-implementation reviewer. No code unless explicitly requested.
EOF
)"
fi

jq -n \
  --arg model "${MODEL}" \
  --arg system "${SYSTEM_CONTENT}" \
  --arg user "${user_content}" \
  '{
    model: $model,
    stream: false,
    temperature: 0.3,
    messages: [
      {role: "system", content: $system},
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

agent_log_deepseek_usage "${response_file}"

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
  "repos/${REPO}/issues/${ISSUE_NUMBER}/comments" \
  -f body="$(cat "${response_file}")"

agent_apply_labels "${ISSUE_NUMBER}" "agent:planned"

echo "Posted DeepSeek comment on issue #${ISSUE_NUMBER}"
