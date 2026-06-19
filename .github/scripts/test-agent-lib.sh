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

assert_issue_assistant_context() {
  local body="$1"
  local expected="$2"
  local actual
  if actual="$(agent_issue_assistant_context_from_comment "${body}")" && [[ "${actual}" == "${expected}" ]]; then
    pass_count=$((pass_count + 1))
    echo "PASS: issue assistant context"
  else
    fail_count=$((fail_count + 1))
    echo "FAIL: issue assistant context for body=${body}" >&2
  fi
}

assert_no_issue_assistant_context() {
  local body="$1"
  if agent_issue_assistant_context_from_comment "${body}" >/dev/null; then
    fail_count=$((fail_count + 1))
    echo "FAIL: expected no issue assistant context for body=${body}" >&2
  else
    pass_count=$((pass_count + 1))
    echo "PASS: no issue assistant context"
  fi
}

assert_skip "github-actions[bot]" "@deepseek hello"
assert_skip "dependabot[bot]" "@deepseek-review please"
assert_skip "human-user" "please review <!-- pi-agent:workflow:deepseek-pr-review -->"
assert_allow "human-user" "@deepseek-review please review this PR"
assert_issue_assistant_context "/deepseek 제안해봐" "제안해봐"
assert_issue_assistant_context "@deepseek 제안해봐" "제안해봐"
assert_issue_assistant_context "@github-actions 너가 제안해봐" "너가 제안해봐"
assert_no_issue_assistant_context "github-actions 너가 제안해봐"

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

assert_issue_context() {
  local body="$1"
  local expected="$2"
  local actual
  if ! actual="$(agent_issue_assistant_context_from_comment "${body}")"; then
    fail_count=$((fail_count + 1))
    echo "FAIL: expected issue assistant context for: ${body}" >&2
    return
  fi
  if [[ "${actual}" == "${expected}" ]]; then
    pass_count=$((pass_count + 1))
    echo "PASS: issue assistant context (${body})"
  else
    fail_count=$((fail_count + 1))
    echo "FAIL: issue assistant context for (${body}); expected (${expected}), got (${actual})" >&2
  fi
}

assert_issue_context "/deepseek plan this" "plan this"
assert_issue_context "@deepseek hello" "hello"
assert_issue_context "@github-actions review" "review"

issue_system="$(agent_issue_review_system_prompt)"
assert_contains "${issue_system}" "pre-implementation review assistant" "issue system persona"
assert_contains "${issue_system}" "P0/P1/P2/P3" "issue review instructions in system"
assert_contains "${issue_system}" "## Conclusion" "issue output sections in system"
if [[ "${issue_system}" == *"Issue body:"* ]]; then
  fail_count=$((fail_count + 1))
  echo "FAIL: issue system prompt must not contain variable issue body placeholder" >&2
else
  pass_count=$((pass_count + 1))
  echo "PASS: issue system prompt excludes variable content"
fi

pr_system="$(agent_pr_review_system_prompt)"
assert_contains "${pr_system}" "strict diff review assistant" "pr system persona"
assert_contains "${pr_system}" "Evidence" "pr review instructions in system"
if [[ "${pr_system}" == *"Diff:"* ]]; then
  fail_count=$((fail_count + 1))
  echo "FAIL: pr system prompt must not contain diff placeholder" >&2
else
  pass_count=$((pass_count + 1))
  echo "PASS: pr system prompt excludes variable content"
fi

if command -v jq >/dev/null 2>&1; then
  usage_fixture="$(mktemp)"
  trap 'rm -f "${usage_fixture}"' EXIT
  cat > "${usage_fixture}" <<'EOF'
{"usage":{"prompt_tokens":1200,"completion_tokens":80,"prompt_cache_hit_tokens":704,"prompt_cache_miss_tokens":496}}
EOF
  usage_line="$(agent_log_deepseek_usage "${usage_fixture}")"
  assert_contains "${usage_line}" "cache_hit=704" "deepseek usage cache_hit"
  assert_contains "${usage_line}" "cache_miss=496" "deepseek usage cache_miss"
  assert_contains "${usage_line}" "prompt=1200" "deepseek usage prompt"
  assert_contains "${usage_line}" "completion=80" "deepseek usage completion"
else
  echo "SKIP: jq not available; skipping deepseek usage tests"
fi

echo ""
echo "Results: ${pass_count} passed, ${fail_count} failed"
if [[ "${fail_count}" -gt 0 ]]; then
  exit 1
fi
