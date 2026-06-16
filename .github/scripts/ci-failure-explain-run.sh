#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-lib.sh
source "${SCRIPT_DIR}/agent-lib.sh"

REPO="${GITHUB_REPOSITORY:?}"
RUN_ID="${WORKFLOW_RUN_ID:?}"
HEAD_SHA="${WORKFLOW_RUN_HEAD_SHA:?}"
WORKFLOW_MARKER="${AGENT_MARKER_PREFIX}ci-failure-explain -->"
PR_NUMBER="${1:-}"

if [[ -z "${PR_NUMBER}" ]]; then
  pr_json="$(gh pr list --repo "${REPO}" --search "${HEAD_SHA}" --state all --json number,headRepository --limit 20)"
  PR_NUMBER="$(echo "${pr_json}" | jq -r --arg repo "${REPO}" '
    [.[] | select(.headRepository.nameWithOwner == $repo)] | .[0].number // empty
  ')"
fi

if [[ -z "${PR_NUMBER}" ]]; then
  echo "No same-repo PR found for sha ${HEAD_SHA}" >&2
  exit 1
fi

head_repo="$(gh pr view "${PR_NUMBER}" --repo "${REPO}" --json headRepository -q '.headRepository.nameWithOwner')"
if [[ "${head_repo}" != "${REPO}" ]]; then
  echo "Skipping fork PR #${PR_NUMBER} (head: ${head_repo})" >&2
  exit 1
fi

existing="$(gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --paginate | jq -r --arg sha "${HEAD_SHA}" --arg marker "${WORKFLOW_MARKER}" '
  [.[] | select(.body | contains($marker) and contains($sha))] | length
')"
if [[ "${existing}" != "0" ]]; then
  echo "CI explain comment already exists for sha ${HEAD_SHA} on PR #${PR_NUMBER}"
  exit 0
fi

log_file="$(mktemp)"
trap 'rm -f "${log_file}"' EXIT

if ! gh run view "${RUN_ID}" --repo "${REPO}" --log-failed > "${log_file}" 2>/dev/null; then
  gh api "repos/${REPO}/actions/runs/${RUN_ID}/jobs" | jq -r '
    .jobs[] | select(.conclusion == "failure") | "## Failed job: \(.name)\n\(.steps[] | select(.conclusion == "failure") | "- step: \(.name)")"
  ' > "${log_file}" || true
fi

if [[ ! -s "${log_file}" ]]; then
  echo "No failed logs available for run ${RUN_ID}" > "${log_file}"
fi

MAX_LOG_CHARS="${MAX_LOG_CHARS:-60000}"
log_text="$(head -c "${MAX_LOG_CHARS}" "${log_file}")"
log_chars="$(wc -c < "${log_file}" | tr -d ' ')"
truncated_note=""
if [[ "${log_chars}" -gt "${MAX_LOG_CHARS}" ]]; then
  truncated_note="Logs were truncated to ${MAX_LOG_CHARS} characters from ${log_chars} total characters."
fi

"${SCRIPT_DIR}/deepseek-ci-explain.sh" \
  "${PR_NUMBER}" \
  "${RUN_ID}" \
  "${HEAD_SHA}" \
  "${log_text}" \
  "${truncated_note}"
