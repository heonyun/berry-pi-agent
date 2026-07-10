#!/usr/bin/env bash
# Shared helpers for pi-agent GitHub automation scripts.

AGENT_MARKER_PREFIX='<!-- pi-agent:workflow:'
AGENT_ANTIGRAVITY_MARKER='<!-- pi-agent:created-by:antigravity -->'

agent_footer() {
  local workflow_id="${1:?workflow id required}"
  local model="${2:-deepseek-v4-flash}"
  local head_sha="${3:-}"
  local review_mode="${4:-}"
  echo ""
  echo "---"
  echo "${AGENT_MARKER_PREFIX}${workflow_id} -->"
  if [[ -n "${head_sha}" ]]; then
    echo "<!-- pi-agent:review-head:${head_sha} -->"
  fi
  if [[ -n "${review_mode}" ]]; then
    echo "<!-- pi-agent:review-mode:${review_mode} -->"
  fi
  if [[ "${review_mode}" == "draft" ]]; then
    echo "_Automated draft review via DeepSeek (${model}) · workflow: ${workflow_id} · mode: draft_"
  else
    echo "_Automated note via DeepSeek (${model}) · workflow: ${workflow_id}_"
  fi
}

agent_output_sections_prompt() {
  cat <<'EOF'
Return markdown with exactly these sections (in this order):
## Conclusion
pass | hold | hold (truncated) | fail

## Summary

## Findings
Use numbered findings. Each actionable finding MUST use this structure:
1. [P1][evidence:diff|issue|heuristic][blocker:yes|no] Short title
   - Evidence: `path:line` — "quoted fragment, diff hunk, or issue text"
   - Why: one sentence on impact
   - Fix: concrete direction

Rules:
- Put non-actionable residual risks under Suggested next steps, not Findings.
- Use evidence:heuristic only when the issue/diff does not contain direct proof.
- Use blocker:no for P2/P3 follow-ups that must not block merge.
- If there are no actionable findings, write "None." under Findings.

## Suggested next steps

## Commands to rerun
Use concrete shell commands, or "none" if not applicable.

Do not include a footer, HTML comments, or workflow markers; the script appends those automatically.
EOF
}

agent_issue_review_instructions() {
  cat <<'EOF'
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
  evidence type (issue|heuristic), blocker yes/no, affected area or likely
  file/function named in the issue, why it matters, an Evidence line, concrete
  recommendation, and needed verification.
- Do not list confirmations or praise as findings.
- In Suggested next steps: order the smallest safe patch/prototype first.
- In Commands to rerun: prefer exact workspace commands from the issue body
  (for example `npm run test --workspace=@berry-pi/context-canvas`). If unsure,
  write "inspect package.json for the exact workspace command" instead of
  inventing jest/vitest flags such as `--testPathPattern`.
EOF
}

agent_pr_review_instructions() {
  cat <<'EOF'
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
- Unified diff lines that start with a space are unchanged context in the same
  file. Read them before claiming a guard, early return, or helper call is
  missing. Keyboard handlers often place `event.repeat`, Escape, or similar
  guards above the changed Delete/Backspace branch.
- Before claiming a helper function lacks behavior (for example arm clearing on
  re-select), check whether that helper's definition appears in the Diff
  section. If only the call site changed and the helper body is outside the
  diff, use evidence:heuristic and blocker:no unless the diff contradicts the
  claim.
- If the PR body Test plan or Summary claims specific tests passed, do not
  assert those tests fail unless the diff directly contradicts that claim.
  Prefer residual risk or needs verification instead of blocker:yes.
- When a "Surrounding file context" section is present, read it before claiming
  guards, helpers, or early returns are missing outside the diff hunks.
- Do not claim a value is random, dynamic, unprotected, missing, or unused unless
  the current diff or provided context contains code evidence for that claim.
- Do not produce generic praise, restatements of the PR, or broad style advice
  unless it points to a real bug or maintainability risk in the diff.
- Use "fail" for blockers or likely correctness/security regressions, "hold"
  for important unresolved risk or missing verification, "hold (truncated)"
  when diff coverage is incomplete and findings depend on unseen hunks, and
  "pass" only when there are no actionable findings.
- When the user message says the diff was truncated, never use "fail" for
  issues in files or hunks not present in the provided Diff section. Use
  "hold (truncated)" instead and list unseen paths under Suggested next steps.
- Before using "fail" or "hold", verify that Findings contains at least one
  current actionable issue backed by evidence. Future-only design limitations
  and nice-to-have tests are not merge blockers by themselves.
- Do not list confirmations, praise, or already-correct behavior as findings.
  Findings must be problems, risks, or verification gaps only.
- Keep non-blocking follow-ups separate from Findings under residual risks or
  Suggested next steps, and state that they are not blockers.
- Do not claim you ran tests.
- Never use Conclusion "fail" with blocker:yes solely because a test "will fail" or "must fail"
  unless the diff itself shows a definite logic error. When Latest CI checks show
  build-check-test passed, treat test-failure claims as needs-verification with
  blocker:no at most.
- When Repository domain invariants are provided, treat them as authoritative over
  generic assumptions (for example MatrixGroup.source is only "auto", not "manual").
- UI elements referenced only inside *.test.ts(x) mocks or test helpers may not exist
  in production components. Read the Test harness context section before claiming
  a button or label is missing from the product UI.
- In "Commands to rerun", suggest only commands supported by the PR context or
  repository scripts visible in the PR body/diff. If unsure, write "inspect
  package.json for the exact workspace command" instead of inventing package
  manager commands.

If there are no actionable findings, say so explicitly in Findings and include
remaining test gaps or residual risks under Suggested next steps only.
When Conclusion is "pass", Findings must be empty (write "None.") — do not list
P2/P3 or missing-test items as numbered findings.
EOF
}

# Draft-PR early review: still evidence-based, but optimized for WIP direction checks.
agent_pr_draft_review_instructions() {
  cat <<'EOF'
Act as an early draft-PR reviewer. The PR is still a draft / WIP — leave a
useful review now, but do not treat polish or incomplete follow-ups as merge
blockers.

Review only the provided PR diff and PR context. Do not invent repository facts
outside the diff. If a risk requires non-diff context, mark it as "needs
verification" instead of stating it as fact.

Draft-mode priorities (in order):
1. Direction fit — does the change address the PR goal / linked issue intent?
2. Correctness traps already visible in the diff (wrong condition, silent early
   return, state not committed before side effects, broken shortcut/IME paths).
3. Acceptance-criteria gaps — behavior claimed in the PR body but missing or
   contradicted in the diff or tests.
4. High-value missing tests for the new behavior (empty-input, IME/composing,
   keyboard shortcut, race/order). Put nice-to-have coverage under Suggested
   next steps, not Findings.
5. Security/privacy or data-loss risks if already evidenced in the diff.

Draft-mode rules:
- Always review draft PRs. Do not refuse or skip because the PR is a draft.
- Start Summary with one short line: "Draft early review — not a merge gate."
- Prefer Conclusion "hold" when the direction is useful but unfinished or
  verification is incomplete. Use "fail" only for clear correctness/security
  bugs already proven in the current diff (P0/P1 with blocker:yes).
- Do not fail solely because CI is pending, the PR is draft, docs are thin,
  naming is imperfect, or follow-up TODOs remain.
- Do not demand merge-ready completeness (changelog, full e2e matrix, polish)
  unless the gap creates a real bug or AC miss evidenced in the diff.
- Every actionable finding must include severity (P0/P1/P2/P3), Evidence citing
  current diff/file/line or quoted fragment, Why, and Fix. No evidence → move
  to Suggested next steps / needs verification.
- On re-review, treat earlier comments as stale until the current diff still
  proves the issue. Do not repeat stale findings.
- Unified diff lines that start with a space are unchanged context — read them
  before claiming a guard/helper is missing.
- If only a call site changed and the helper body is outside the Diff section,
  use evidence:heuristic and blocker:no unless the diff contradicts the claim.
- When "Surrounding file context" or "Test harness context" is present, read it
  before claiming missing UI/guards/helpers.
- When Repository domain invariants are provided, treat them as authoritative.
- Do not claim you ran tests. Suggest only concrete commands supported by the
  PR context; otherwise say to inspect package.json.
- Use "hold (truncated)" when the diff was truncated and findings depend on
  unseen hunks. Never "fail" on files absent from the provided Diff section.
- Findings must be problems, risks, or AC/verification gaps only — no praise
  lists. When Conclusion is "pass", Findings must be "None."

If the draft looks directionally sound with no actionable bugs, Conclusion may
be "pass" with Findings "None." and remaining WIP items under Suggested next
steps only.
EOF
}

# Context Canvas domain contracts injected into PR reviews when the diff touches that app.
agent_pr_domain_invariants_prompt() {
  cat <<'EOF'
Repository domain invariants (authoritative for apps/context-canvas):
- MatrixGroup.source is exactly "auto" only. Do not claim snapshots or validators must accept "manual".
- MatrixHistorySnapshotGroup.source follows MatrixGroup.source ("auto" only).
- isMatrixHistorySnapshot rejecting non-"auto" group source matches the domain; that is not data-loss for manual groups.
- Reference edit mode (#103+): bare body "==" enters pick mode; full formulas like "=SUM(A1)" do not.
- Test files (*.test.tsx) often define mock buttons/labels (for example "edit text", "replay A1") that are not production UI.

When a finding contradicts these invariants, move it to Suggested next steps as needs-verification or drop it.
EOF
}

# Exit 0 when CI build-check-test (or build-check) passed in gh pr checks output.
agent_ci_build_check_passed() {
  local checks="${1:-}"
  if [[ -z "${checks}" ]] || [[ "${checks}" == "unavailable" ]]; then
    return 1
  fi
  printf '%s\n' "${checks}" | awk '
    tolower($0) ~ /build-check/ && tolower($0) ~ /pass/ { found=1 }
    END { exit(found ? 0 : 1) }
  '
}

# Exit 0 when the PR changes files under apps/context-canvas/.
agent_pr_touches_context_canvas() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local filenames
  filenames="$(gh api "repos/${repo}/pulls/${pr_number}/files" --jq '.[].filename' 2>/dev/null || true)"
  [[ -n "${filenames}" ]] && printf '%s\n' "${filenames}" | grep -q '^apps/context-canvas/'
}

# Exit 0 when an automated review for this head SHA was already posted (skip re-run).
# Optional 5th arg review_mode (ready|draft): if the latest comment for this head
# used a different mode, do not skip so draft→ready (or forced mode change) re-runs.
agent_pr_should_skip_duplicate_review() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local head_sha="${3:?head sha required}"
  local workflow_id="${4:-deepseek-pr-review}"
  local review_mode="${5:-}"
  local marker="${AGENT_MARKER_PREFIX}${workflow_id} -->"
  local head_marker="<!-- pi-agent:review-head:${head_sha} -->"
  local comments body

  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  comments="$(gh api "repos/${repo}/issues/${pr_number}/comments" --paginate 2>/dev/null || true)"
  body="$(printf '%s' "${comments}" | jq -r --arg m "${marker}" --arg h "${head_marker}" '
    [.[] | select(.body | contains($m))] | last | .body // empty
  ' 2>/dev/null || true)"

  if [[ -z "${body}" ]] || [[ "${body}" != *"${head_marker}"* ]]; then
    return 1
  fi

  if [[ -n "${review_mode}" ]]; then
    local mode_marker="<!-- pi-agent:review-mode:${review_mode} -->"
    if [[ "${body}" != *"${mode_marker}"* ]]; then
      # Same head, different mode (e.g. draft comment then ready_for_review) → re-run.
      return 1
    fi
  fi

  return 0
}

# Find the latest issue comment id for a workflow marker (prints id or empty).
agent_pr_latest_workflow_comment_id() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local workflow_id="${3:?workflow id required}"
  local marker="${AGENT_MARKER_PREFIX}${workflow_id} -->"

  gh api "repos/${repo}/issues/${pr_number}/comments" --paginate \
    --jq ".[] | select(.body | contains(\"${marker}\")) | .id" 2>/dev/null | tail -1
}

# Create or update the single workflow review comment on a PR/issue.
agent_pr_upsert_review_comment() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local body="${3:?body required}"
  local workflow_id="${4:?workflow id required}"
  local comment_id

  comment_id="$(agent_pr_latest_workflow_comment_id "${repo}" "${pr_number}" "${workflow_id}")"
  if [[ -n "${comment_id}" ]]; then
    gh api \
      -X PATCH \
      "repos/${repo}/issues/comments/${comment_id}" \
      -f body="${body}" >/dev/null
    echo "Updated DeepSeek PR review comment #${comment_id} on PR #${pr_number}"
    return 0
  fi

  gh api \
    "repos/${repo}/issues/${pr_number}/comments" \
    -f body="${body}" >/dev/null
  echo "Posted DeepSeek PR review comment on PR #${pr_number}"
}

# Fetch top-of-file / mock harness excerpts from changed test files on the PR head.
agent_pr_test_harness_context() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local max_files="${3:-3}"
  local max_chars="${4:-12000}"

  if ! command -v gh >/dev/null 2>&1; then
    return 0
  fi

  local head_sha filenames file_count total_chars snippets block block_len
  head_sha="$(gh api "repos/${repo}/pulls/${pr_number}" --jq '.head.sha' 2>/dev/null || true)"
  if [[ -z "${head_sha}" ]]; then
    return 0
  fi

  filenames="$(gh api "repos/${repo}/pulls/${pr_number}/files" --jq '.[].filename' 2>/dev/null \
    | grep -E '\.test\.(ts|tsx)$' || true)"
  if [[ -z "${filenames}" ]]; then
    return 0
  fi

  file_count=0
  total_chars=0
  snippets=""

  while IFS= read -r filename; do
    [[ -z "${filename}" ]] && continue
    if [[ "${file_count}" -ge "${max_files}" ]]; then
      break
    fi

    local encoded_path content_b64 content excerpt
    encoded_path="$(jq -rn --arg v "${filename}" '$v|@uri')"
    content_b64="$(gh api "repos/${repo}/contents/${encoded_path}?ref=${head_sha}" \
      --jq '.content // empty' 2>/dev/null | tr -d '\n' || true)"
    if [[ -z "${content_b64}" ]]; then
      continue
    fi

    content="$(printf '%s' "${content_b64}" | base64 -d 2>/dev/null || true)"
    if [[ -z "${content}" ]]; then
      continue
    fi

    excerpt="$(printf '%s\n' "${content}" | head -n 160)"
    block="$(cat <<EOF

### ${filename} (test harness excerpt, first 160 lines)
\`\`\`typescript
${excerpt}
\`\`\`
EOF
)"

    block_len="${#block}"
    if [[ $(( total_chars + block_len )) -gt "${max_chars}" ]]; then
      break
    fi

    snippets="${snippets}${block}"
    total_chars=$(( total_chars + block_len ))
    file_count=$(( file_count + 1 ))
  done <<<"${filenames}"

  if [[ -n "${snippets}" ]]; then
    echo "Test harness context (mocks/helpers in changed test files; not production UI):"
    printf '%s\n' "${snippets}"
    echo ""
  fi
}

agent_ci_explain_instructions() {
  cat <<'EOF'
Analyze the failed CI logs provided in the user message. Identify the failing
step/command, likely root cause, suspect files, and concrete rerun commands.

Set Conclusion to fail.
EOF
}

# Stable system prompt for issue planning/review (prefix-friendly for DeepSeek cache).
agent_issue_review_system_prompt() {
  cat <<EOF
You are a pre-implementation review assistant for berry-pi-agent, the pi-agent repository. Find design gaps, implementation risks, incorrect assumptions, and verification needs before work starts. Be concise, concrete, and structured. Prefer concise Korean when the issue text is Korean.

$(agent_issue_review_instructions)

$(agent_output_sections_prompt)
EOF
}

# Stable system prompt for PR diff review.
# Optional arg: review_mode = ready|draft (default ready).
agent_pr_review_system_prompt() {
  local review_mode="${1:-ready}"
  if [[ "${review_mode}" == "draft" ]]; then
    cat <<EOF
You are an early draft-PR review assistant for berry-pi-agent. Review draft PRs with a WIP lens: catch direction mistakes, evidenced bugs, and AC gaps, while avoiding merge-gate nitpicks. Do not claim you ran tests. Prefer concise Korean when the PR text is Korean.

$(agent_pr_draft_review_instructions)

$(agent_output_sections_prompt)
EOF
  else
    cat <<EOF
You are a strict diff review assistant for berry-pi-agent. Lead with actionable bugs and risks grounded in the provided diff. Do not claim you ran tests. Prefer concise Korean when the PR text is Korean.

$(agent_pr_review_instructions)

$(agent_output_sections_prompt)
EOF
  fi
}

# Stable system prompt for CI failure analysis.
agent_ci_explain_system_prompt() {
  cat <<EOF
You are a CI failure analysis assistant for berry-pi-agent. Base findings on the provided logs only. Do not claim you ran commands. Prefer concise Korean when surrounding context is Korean.

$(agent_ci_explain_instructions)

$(agent_output_sections_prompt)
EOF
}

# Extract the first non-empty line under ## Conclusion (lowercased, trimmed).
agent_extract_conclusion() {
  local body="${1:-}"
  awk '
    /^## Conclusion[[:space:]]*$/ { in_section=1; next }
    in_section && /^## / { exit }
    in_section && NF {
      line=$0
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      gsub(/^`+|`+$/, "", line)
      print tolower(line)
      exit
    }
  ' <<<"${body}"
}

# Count numbered findings (lines like "1. ...") inside the Findings section.
agent_count_numbered_findings() {
  local body="${1:-}"
  awk '
    /^## Findings[[:space:]]*$/ { in_section=1; next }
    in_section && /^## / { exit }
    in_section && /^[0-9]+\.[[:space:]]/ { count++ }
    END { print count + 0 }
  ' <<<"${body}"
}

# Exit 0 when at least one finding includes an Evidence line.
agent_findings_have_evidence() {
  local body="${1:-}"
  awk '
    /^## Findings[[:space:]]*$/ { in_section=1; next }
    in_section && /^## / { exit }
    in_section && tolower($0) ~ /^[[:space:]]*- evidence:/ { found=1 }
    END { exit(found ? 0 : 1) }
  ' <<<"${body}"
}

# Normalize model output before posting to GitHub.
# Args: comment_body diff_truncated(0|1) [ci_build_passed(0|1)]
agent_post_process_review_comment() {
  local body="${1:-}"
  local diff_truncated="${2:-0}"
  local ci_build_passed="${3:-0}"
  local notes=()
  local conclusion
  local finding_count

  conclusion="$(agent_extract_conclusion "${body}")"
  finding_count="$(agent_count_numbered_findings "${body}")"

  if [[ "${diff_truncated}" == "1" ]] && [[ "${conclusion}" == "fail" ]]; then
    body="$(printf '%s\n' "${body}" | sed '0,/^## Conclusion$/{n;s/^fail[[:space:]]*$/hold (truncated)/;s/^`fail`[[:space:]]*$/hold (truncated)/}')"
    notes+=("Diff was truncated; Conclusion downgraded from \`fail\` to \`hold (truncated)\`.")
    conclusion="$(agent_extract_conclusion "${body}")"
  fi

  if [[ "${ci_build_passed}" == "1" ]] && [[ "${conclusion}" == "fail" ]]; then
    if printf '%s' "${body}" | grep -Eiq 'test|테스트|will fail|must fail|반드시 실패|crash|typeerror'; then
      body="$(printf '%s\n' "${body}" | sed '0,/^## Conclusion$/{n;s/^fail[[:space:]]*$/hold/;s/^`fail`[[:space:]]*$/hold/}')"
      notes+=("CI \`build-check-test\` passed; Conclusion downgraded from \`fail\` to \`hold\` because test-failure claims were not verified in CI.")
      conclusion="$(agent_extract_conclusion "${body}")"
    fi
  fi

  if [[ "${ci_build_passed}" == "1" ]] && [[ "${conclusion}" =~ ^(fail|hold)$ ]]; then
    notes+=("CI \`build-check-test\` passed. DeepSeek \`${conclusion}\` is advisory — Codex should re-verify locally before blocking merge.")
  fi

  if [[ "${finding_count}" -eq 0 ]] && [[ "${conclusion}" =~ ^(fail|hold)$ ]]; then
    notes+=("Conclusion is \`${conclusion}\` but Findings has no numbered actionable items; treat as non-blocking unless Codex verifies.")
  fi

  if [[ "${finding_count}" -gt 0 ]] && [[ "${conclusion}" == "pass" ]]; then
    notes+=("Conclusion is \`pass\` but Findings has ${finding_count} numbered item(s); triage each — non-blockers belong under Suggested next steps per output schema.")
  fi

  if [[ "${finding_count}" -gt 0 ]] && ! agent_findings_have_evidence "${body}"; then
    notes+=("Findings lack explicit \`- Evidence:\` lines; treat as needs-verification.")
  fi

  if [[ ${#notes[@]} -eq 0 ]]; then
    printf '%s' "${body}"
    return 0
  fi

  {
    echo "> **Review note (automated):** ${notes[0]}"
    if [[ ${#notes[@]} -gt 1 ]]; then
      local idx
      for ((idx = 1; idx < ${#notes[@]}; idx++)); do
        echo "> ${notes[idx]}"
      done
    fi
    echo ""
    printf '%s' "${body}"
  }
}

# Build PR diff metadata for the user prompt.
# Writes to stdout: changed file list block and truncation note.
# Args: diff_file max_diff_chars repo pr_number
agent_pr_diff_metadata() {
  local diff_file="${1:?diff file required}"
  local max_diff_chars="${2:?max chars required}"
  local repo="${3:?repo required}"
  local pr_number="${4:?pr number required}"

  local diff_chars
  diff_chars="$(wc -c < "${diff_file}" | tr -d ' ')"
  local changed_files
  changed_files="$(gh api "repos/${repo}/pulls/${pr_number}/files" --jq '.[].filename' 2>/dev/null || true)"
  local file_count=0
  if [[ -n "${changed_files}" ]]; then
    file_count="$(printf '%s\n' "${changed_files}" | sed '/^$/d' | wc -l | tr -d ' ')"
    echo "Changed files (${file_count}):"
    printf '%s\n' "${changed_files}"
    echo ""
  fi

  if [[ "${diff_chars}" -gt "${max_diff_chars}" ]]; then
    echo "Diff coverage: first ${max_diff_chars} of ${diff_chars} characters."
    echo "Diff was truncated. Use Conclusion: hold (truncated) when findings depend on unseen hunks."
    echo "Do not use Conclusion: fail for code outside the Diff section below."
    if [[ -n "${changed_files}" ]]; then
      echo "Unverified paths (may be missing from Diff section):"
      printf '%s\n' "${changed_files}"
    fi
    echo ""
  fi
}

# Fetch ±N lines around the first diff hunk per changed file (PR head).
# Args: repo pr_number [context_lines] [max_files] [max_chars]
agent_pr_surrounding_context() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local context_lines="${3:-25}"
  local max_files="${4:-4}"
  local max_chars="${5:-14000}"

  if ! command -v gh >/dev/null 2>&1; then
    return 0
  fi

  local head_sha
  head_sha="$(gh api "repos/${repo}/pulls/${pr_number}" --jq '.head.sha' 2>/dev/null || true)"
  if [[ -z "${head_sha}" ]]; then
    return 0
  fi

  local filenames test_files other_files sorted_files
  filenames="$(gh api "repos/${repo}/pulls/${pr_number}/files" --jq '.[].filename' 2>/dev/null || true)"
  if [[ -z "${filenames}" ]]; then
    return 0
  fi

  test_files="$(printf '%s\n' "${filenames}" | grep -E '\.test\.(ts|tsx)$' || true)"
  other_files="$(printf '%s\n' "${filenames}" | grep -vE '\.test\.(ts|tsx)$' || true)"
  sorted_files="$(printf '%s\n%s\n' "${test_files}" "${other_files}" | sed '/^$/d')"

  local file_count=0
  local total_chars=0
  local snippets=""

  while IFS= read -r filename; do
    [[ -z "${filename}" ]] && continue
    if [[ "${file_count}" -ge "${max_files}" ]]; then
      break
    fi

    local patch start_line
    patch="$(gh api "repos/${repo}/pulls/${pr_number}/files" --paginate \
      --jq ".[] | select(.filename==\"${filename}\") | .patch // empty" 2>/dev/null || true)"
    if [[ -z "${patch}" ]]; then
      continue
    fi

    start_line="$(printf '%s\n' "${patch}" | sed -n 's/^@@ -[0-9,]* +\([0-9]*\).*/\1/p' | head -1)"
    if [[ -z "${start_line}" ]]; then
      continue
    fi

    local encoded_path content_b64 content from to excerpt block block_len
    encoded_path="$(jq -rn --arg v "${filename}" '$v|@uri')"
    content_b64="$(gh api "repos/${repo}/contents/${encoded_path}?ref=${head_sha}" \
      --jq '.content // empty' 2>/dev/null | tr -d '\n' || true)"
    if [[ -z "${content_b64}" ]]; then
      continue
    fi

    content="$(printf '%s' "${content_b64}" | base64 -d 2>/dev/null || true)"
    if [[ -z "${content}" ]]; then
      continue
    fi

    from=$(( start_line > context_lines ? start_line - context_lines : 1 ))
    to=$(( start_line + context_lines ))
    excerpt="$(printf '%s\n' "${content}" | awk -v from="${from}" -v to="${to}" \
      'NR >= from && NR <= to { printf "%5d| %s\n", NR, $0 }')"

    block="$(cat <<EOF

### ${filename} (HEAD ±${context_lines} around first hunk @ line ${start_line})
\`\`\`
${excerpt}
\`\`\`
EOF
)"

    block_len="${#block}"
    if [[ $(( total_chars + block_len )) -gt "${max_chars}" ]]; then
      break
    fi

    snippets="${snippets}${block}"
    total_chars=$(( total_chars + block_len ))
    file_count=$(( file_count + 1 ))
  done <<<"${sorted_files}"

  if [[ -n "${snippets}" ]]; then
    echo "Surrounding file context (from PR head; use with Diff section):"
    printf '%s\n' "${snippets}"
    echo ""
  fi
}

# When CI checks failed on the PR head, attach a truncated failed-job log excerpt.
# Args: repo pr_number [max_chars]
agent_pr_failed_ci_logs() {
  local repo="${1:?repo required}"
  local pr_number="${2:?pr number required}"
  local max_chars="${3:-8000}"

  if ! command -v gh >/dev/null 2>&1; then
    return 0
  fi

  local checks failed_checks
  checks="$(gh pr checks "${pr_number}" --repo "${repo}" 2>/dev/null || true)"
  if [[ -z "${checks}" ]]; then
    return 0
  fi

  failed_checks="$(printf '%s\n' "${checks}" | awk 'tolower($2) ~ /^(fail|failure)$/ { print }')"
  if [[ -z "${failed_checks}" ]]; then
    return 0
  fi

  echo "Failed CI checks (informational; do not claim you ran them):"
  printf '%s\n' "${failed_checks}"
  echo ""

  local head_sha run_id log_excerpt
  head_sha="$(gh api "repos/${repo}/pulls/${pr_number}" --jq '.head.sha' 2>/dev/null || true)"
  if [[ -z "${head_sha}" ]]; then
    return 0
  fi

  run_id="$(gh api "repos/${repo}/actions/runs?head_sha=${head_sha}&status=completed" \
    --jq '.workflow_runs[] | select(.conclusion=="failure") | .id' 2>/dev/null | head -1 || true)"
  if [[ -z "${run_id}" ]]; then
    return 0
  fi

  log_excerpt="$(gh run view "${run_id}" --repo "${repo}" --log-failed 2>/dev/null | tail -n 150 | head -c "${max_chars}" || true)"
  if [[ -n "${log_excerpt}" ]]; then
    echo "Failed job log excerpt (truncated):"
    printf '%s\n' "${log_excerpt}"
    echo ""
  fi
}

# DeepSeek V4 thinking mode ignores temperature/top_p/penalties (no API error).
# DEEPSEEK_REASONING_EFFORT: max (default) | high | off
agent_deepseek_write_payload() {
  local payload_file="${1:?payload file required}"
  local model="${2:?model required}"
  local system="${3:?system required}"
  local user="${4:?user required}"
  local temperature="${5:-0.2}"

  local effort_raw="${DEEPSEEK_REASONING_EFFORT:-max}"
  effort_raw="$(printf '%s' "${effort_raw}" | tr '[:upper:]' '[:lower:]')"

  case "${effort_raw}" in
    off|disabled|none|false|0)
      jq -n \
        --arg model "${model}" \
        --arg system "${system}" \
        --arg user "${user}" \
        --arg temperature "${temperature}" \
        '{
          model: $model,
          stream: false,
          thinking: {type: "disabled"},
          temperature: ($temperature | tonumber),
          messages: [
            {role: "system", content: $system},
            {role: "user", content: $user}
          ]
        }' > "${payload_file}"
      ;;
    max|xhigh)
      jq -n \
        --arg model "${model}" \
        --arg system "${system}" \
        --arg user "${user}" \
        --arg reasoning_effort "max" \
        '{
          model: $model,
          stream: false,
          thinking: {type: "enabled"},
          reasoning_effort: $reasoning_effort,
          messages: [
            {role: "system", content: $system},
            {role: "user", content: $user}
          ]
        }' > "${payload_file}"
      ;;
    *)
      jq -n \
        --arg model "${model}" \
        --arg system "${system}" \
        --arg user "${user}" \
        --arg reasoning_effort "high" \
        '{
          model: $model,
          stream: false,
          thinking: {type: "enabled"},
          reasoning_effort: $reasoning_effort,
          messages: [
            {role: "system", content: $system},
            {role: "user", content: $user}
          ]
        }' > "${payload_file}"
      ;;
  esac
}

# Log DeepSeek prompt cache usage from a chat/completions response JSON file.
agent_log_deepseek_usage() {
  local response_file="${1:?response file required}"
  jq -r '.usage | "DeepSeek usage: cache_hit=\(.prompt_cache_hit_tokens // 0) cache_miss=\(.prompt_cache_miss_tokens // 0) prompt=\(.prompt_tokens // 0) completion=\(.completion_tokens // 0) reasoning=\(.completion_tokens_details.reasoning_tokens // 0)"' \
    "${response_file}"
}

# Exit 0 when the issue body was created or delegated via Antigravity CLI.
agent_issue_has_antigravity_marker() {
  local body="${1:-}"
  [[ "${body}" == *"${AGENT_ANTIGRAVITY_MARKER}"* ]]
}

# Exit 0 when an opened/reopened issue should receive automatic planning.
# Args: issue_author issue_association issue_body
agent_issue_eligible_for_auto_plan() {
  local author="${1:-}"
  local association="${2:-}"
  local body="${3:-}"

  if agent_issue_has_antigravity_marker "${body}"; then
    return 0
  fi

  if [[ "${author}" == *"[bot]" ]] || [[ "${author}" == "dependabot[bot]" ]]; then
    return 1
  fi

  if [[ "${association}" =~ ^(OWNER|MEMBER|COLLABORATOR)$ ]]; then
    return 0
  fi

  return 1
}

# Exit 0 when the comment should be skipped (bot or agent marker present).
# Exit 1 when the comment should be processed.
agent_should_skip_comment() {
  local actor="${1:-}"
  local body="${2:-}"

  if [[ "${actor}" == "github-actions[bot]" ]] || [[ "${actor}" == *"[bot]" ]]; then
    return 0
  fi

  if [[ "${body}" == *"${AGENT_MARKER_PREFIX}"* ]]; then
    return 0
  fi

  return 1
}

# Prints the additional context for supported issue assistant commands.
# Exit 0 when the comment invokes the issue assistant, otherwise exit 1.
agent_issue_assistant_context_from_comment() {
  local body="${1:-}"

  case "${body}" in
    /deepseek*)
      local context="${body#/deepseek}"
      echo "${context# }"
      return 0
      ;;
    @deepseek*)
      local context="${body#@deepseek}"
      echo "${context# }"
      return 0
      ;;
    @github-actions*)
      local context="${body#@github-actions}"
      echo "${context# }"
      return 0
      ;;
  esac

  return 1
}

agent_apply_labels() {
  local issue_number="${1:?issue number required}"
  shift
  local repo="${GITHUB_REPOSITORY:?}"

  if [[ $# -eq 0 ]]; then
    return 0
  fi

  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not available; skipping labels" >&2
    return 0
  fi

  local labels_json
  labels_json="$(printf '%s\n' "$@" | jq -R . | jq -s '{labels: .}')"

  if ! gh api \
    -X POST \
    "repos/${repo}/issues/${issue_number}/labels" \
    --input - <<<"${labels_json}" 2>/dev/null; then
    echo "Warning: failed to apply labels ($*) to #${issue_number}" >&2
  fi
}

agent_remove_label() {
  local issue_number="${1:?issue number required}"
  local label="${2:?label required}"
  local repo="${GITHUB_REPOSITORY:?}"

  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI not available; skipping label removal" >&2
    return 0
  fi

  local encoded_label
  encoded_label="$(jq -rn --arg v "${label}" '$v|@uri')"

  if ! gh api \
    -X DELETE \
    "repos/${repo}/issues/${issue_number}/labels/${encoded_label}" 2>/dev/null; then
    echo "Warning: failed to remove label ${label} from #${issue_number}" >&2
  fi
}
