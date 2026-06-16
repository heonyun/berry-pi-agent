#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=agent-lib.sh
source "${SCRIPT_DIR}/agent-lib.sh"

pass_count=0
fail_count=0

assert_skip() {
  local actor="$1"
  local body="$2"
  if agent_should_skip_comment "${actor}" "${body}"; then
    pass_count=$((pass_count + 1))
    echo "PASS: skip ${actor}"
  else
    fail_count=$((fail_count + 1))
    echo "FAIL: expected skip for actor=${actor}" >&2
  fi
}

assert_allow() {
  local actor="$1"
  local body="$2"
  if agent_should_skip_comment "${actor}" "${body}"; then
    fail_count=$((fail_count + 1))
    echo "FAIL: expected allow for actor=${actor}" >&2
  else
    pass_count=$((pass_count + 1))
    echo "PASS: allow ${actor}"
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    pass_count=$((pass_count + 1))
    echo "PASS: ${label}"
  else
    fail_count=$((fail_count + 1))
    echo "FAIL: ${label} (missing: ${needle})" >&2
  fi
}

assert_skip "github-actions[bot]" "@deepseek hello"
assert_skip "dependabot[bot]" "@deepseek-review please"
assert_skip "human-user" "please review <!-- pi-agent:workflow:deepseek-pr-review -->"
assert_allow "human-user" "@deepseek-review please review this PR"

assert_antigravity_plan() {
  local author="$1"
  local association="$2"
  local body="$3"
  if agent_issue_eligible_for_auto_plan "${author}" "${association}" "${body}"; then
    pass_count=$((pass_count + 1))
    echo "PASS: auto-plan ${author}"
  else
    fail_count=$((fail_count + 1))
    echo "FAIL: expected auto-plan for author=${author}" >&2
  fi
}

assert_no_auto_plan() {
  local author="$1"
  local association="$2"
  local body="$3"
  if agent_issue_eligible_for_auto_plan "${author}" "${association}" "${body}"; then
    fail_count=$((fail_count + 1))
    echo "FAIL: expected no auto-plan for author=${author}" >&2
  else
    pass_count=$((pass_count + 1))
    echo "PASS: no auto-plan ${author}"
  fi
}

assert_antigravity_plan "heonyun" "OWNER" "design issue"
assert_antigravity_plan "github-actions[bot]" "NONE" "plan me <!-- pi-agent:created-by:antigravity -->"
assert_no_auto_plan "github-actions[bot]" "NONE" "bot issue without marker"
assert_no_auto_plan "random-user" "NONE" "untrusted issue"

footer="$(agent_footer "deepseek-pr-review" "deepseek-v4-flash")"
assert_contains "${footer}" "<!-- pi-agent:workflow:deepseek-pr-review -->" "footer marker"
assert_contains "${footer}" "workflow: deepseek-pr-review" "footer workflow id"

sections="$(agent_output_sections_prompt)"
assert_contains "${sections}" "## Conclusion" "output sections prompt"
assert_contains "${sections}" "## Commands to rerun" "rerun section prompt"

echo ""
echo "Results: ${pass_count} passed, ${fail_count} failed"
if [[ "${fail_count}" -gt 0 ]]; then
  exit 1
fi
