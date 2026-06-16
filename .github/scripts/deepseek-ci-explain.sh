#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-lib.sh
source "${SCRIPT_DIR}/agent-lib.sh"

PR_NUMBER="${1:?PR number required}"
RUN_ID="${2:?run id required}"
HEAD_SHA="${3:?head sha required}"
LOG_TEXT="${4:-}"
TRUNCATED_NOTE="${5:-}"
MODEL="${DEEPSEEK_MODEL:-deepseek-v4-flash}"
REPO="${GITHUB_REPOSITORY:?}"
WORKFLOW_ID="ci-failure-explain"
OUTPUT_SECTIONS="$(agent_output_sections_prompt)"

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "DEEPSEEK_API_KEY is not set" >&2
  exit 1
fi

payload_file="$(mktemp)"
response_file="$(mktemp)"
trap 'rm -f "${payload_file}" "${response_file}"' EXIT

user_content="$(cat <<EOF
Repository: ${REPO}
Pull request #${PR_NUMBER}
Failed CI workflow run id: ${RUN_ID}
Head SHA: ${HEAD_SHA}

${TRUNCATED_NOTE}

Analyze the failed CI logs below. Identify the failing step/command, likely root cause, suspect files, and concrete rerun commands.

Set Conclusion to fail.

${OUTPUT_SECTIONS}

Failed CI logs:
${LOG_TEXT}
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
        content: "You are a CI failure analysis assistant for berry-pi-agent. Base findings on the provided logs only. Do not claim you ran commands. Prefer concise Korean when surrounding context is Korean."
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
  echo ""
  echo "Head SHA: \`${HEAD_SHA}\`"
  agent_footer "${WORKFLOW_ID}" "${MODEL}"
} > "${response_file}"

gh api \
  "repos/${REPO}/issues/${PR_NUMBER}/comments" \
  -f body="$(cat "${response_file}")"

agent_apply_labels "${PR_NUMBER}" "ci:failed"

echo "Posted CI failure explanation on PR #${PR_NUMBER}"
