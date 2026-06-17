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
OUTPUT_SECTIONS="$(agent_output_sections_prompt)"
ISSUE_REVIEW_INSTRUCTIONS="$(cat <<'EOF'
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
)"

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

${ISSUE_REVIEW_INSTRUCTIONS}

${OUTPUT_SECTIONS}

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

${ISSUE_REVIEW_INSTRUCTIONS}

${OUTPUT_SECTIONS}
EOF
)"
fi

jq -n \
  --arg model "${MODEL}" \
  --arg user "${user_content}" \
  '{
    model: $model,
    stream: false,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You are a pre-implementation review assistant for berry-pi-agent, the pi-agent repository. Find design gaps, implementation risks, incorrect assumptions, and verification needs before work starts. Be concise, concrete, and structured. Prefer concise Korean when the issue text is Korean."
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
  "repos/${REPO}/issues/${ISSUE_NUMBER}/comments" \
  -f body="$(cat "${response_file}")"

agent_apply_labels "${ISSUE_NUMBER}" "agent:planned"

echo "Posted DeepSeek comment on issue #${ISSUE_NUMBER}"
