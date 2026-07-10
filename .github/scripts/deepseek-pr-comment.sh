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

pr_meta_json="$(gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '{sha: .head.sha, draft: .draft}' 2>/dev/null || echo '{}')"
head_sha="$(jq -r '.sha // empty' <<<"${pr_meta_json}")"
# Prefer live PR API draft flag. PR_IS_DRAFT is only a fallback (e.g. API miss).
is_draft="$(jq -r 'if .draft == true then "true" else empty end' <<<"${pr_meta_json}")"
if [[ -z "${is_draft}" ]]; then
  case "${PR_IS_DRAFT:-}" in
    true|True|TRUE) is_draft="true" ;;
    *) is_draft="false" ;;
  esac
fi

review_mode="ready"
if [[ "${is_draft}" == "true" ]]; then
  review_mode="draft"
fi

SYSTEM_CONTENT="$(agent_pr_review_system_prompt "${review_mode}")"

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "DEEPSEEK_API_KEY is not set" >&2
  exit 1
fi

force_rerun=0
if [[ -n "${EXTRA}" ]]; then
  force_rerun=1
fi
# ready_for_review / explicit mode change must re-run even on the same head SHA.
if [[ "${EVENT_ACTION:-}" == "ready_for_review" ]]; then
  force_rerun=1
fi

if [[ "${force_rerun}" -eq 0 ]] && [[ -n "${head_sha}" ]] &&
  agent_pr_should_skip_duplicate_review "${REPO}" "${PR_NUMBER}" "${head_sha}" "${WORKFLOW_ID}" "${review_mode}"; then
  echo "Skipping duplicate DeepSeek PR review for head ${head_sha} (mode=${review_mode})"
  exit 0
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

test_harness_context="$(agent_pr_test_harness_context "${REPO}" "${PR_NUMBER}" "${TEST_HARNESS_MAX_FILES:-3}" "${TEST_HARNESS_MAX_CHARS:-12000}")"

domain_invariants=""
if agent_pr_touches_context_canvas "${REPO}" "${PR_NUMBER}"; then
  domain_invariants="$(agent_pr_domain_invariants_prompt)"
fi

ci_checks="$(gh pr checks "${PR_NUMBER}" --repo "${REPO}" 2>/dev/null | head -20 || echo "unavailable")"

failed_ci_logs="$(agent_pr_failed_ci_logs "${REPO}" "${PR_NUMBER}" "${FAILED_CI_LOG_MAX_CHARS:-8000}")"

ci_build_passed=0
if agent_ci_build_check_passed "${ci_checks}"; then
  ci_build_passed=1
fi

draft_banner=""
if [[ "${review_mode}" == "draft" ]]; then
  draft_banner="$(cat <<'EOF'
PR state: draft (WIP)
Review mode: draft early review — leave actionable direction/correctness feedback now.
Do not refuse to review because this is a draft. Prefer hold over fail for unfinished work.
EOF
)"
else
  draft_banner="$(cat <<'EOF'
PR state: ready for review
Review mode: merge-gate diff review.
EOF
)"
fi

user_content="$(cat <<EOF
Repository: ${REPO}
Pull request #${PR_NUMBER}: ${TITLE}
PR head: ${head_sha:-unknown}

${draft_banner}

PR body:
${BODY}

Additional request:
${EXTRA}

${diff_metadata}

${domain_invariants}

${test_harness_context}

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

comment_body="$(agent_post_process_review_comment "${comment_body}" "${diff_truncated}" "${ci_build_passed}")"

{
  echo "${comment_body}"
  agent_footer "${WORKFLOW_ID}" "${MODEL}" "${head_sha}" "${review_mode}"
} > "${response_file}"

agent_pr_upsert_review_comment "${REPO}" "${PR_NUMBER}" "$(cat "${response_file}")" "${WORKFLOW_ID}"

agent_apply_labels "${PR_NUMBER}" "agent:reviewed"
