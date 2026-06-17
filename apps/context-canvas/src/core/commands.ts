import type { Vec2 } from "../shared/domain.ts";

export type BranchDirection = "critical" | "constructive";

export type CanvasCommand =
  | { type: "update_prompt_text"; nodeId: string; text: string }
  | { type: "set_answer_text"; answerId: string; text: string }
  | { type: "move_node"; nodeId: string; position: Vec2 }
  | { type: "set_feedback"; nodeId: string; feedback: import("../shared/domain.ts").FeedbackState }
  | { type: "branch_from_answer"; answerId: string; direction: BranchDirection }
  | { type: "create_prompt_at"; position: Vec2; parentAnswerId?: string }
  | { type: "connect_context_reference"; source: string; target: string }
  | { type: "ensure_answer_for_prompt"; promptId: string }
  | { type: "ensure_next_prompt"; answerId: string }
  | { type: "prepare_answer_retry"; answerId: string };

export interface CommandMeta {
  promptId?: string;
  answerId?: string;
  createdAnswer?: boolean;
  statusMessage?: string;
}

export interface ApplyResult {
  document: import("../shared/domain.ts").ContextCanvasDocument;
  meta: CommandMeta;
}
