import type { Vec2 } from "../shared/domain.ts";

export type QABlockAnswerAction = "risks" | "positives" | "risk_retry";

export type QABlockCommand =
  | {
      type: "create_block_from_composer";
      question: string;
      selectedBlockId: string | null;
      anchor?: Vec2;
    }
  | { type: "create_block_at"; position: Vec2; question?: string }
  | {
      type: "create_block_from_action";
      action: QABlockAnswerAction;
      selectedBlockId: string;
      anchor?: Vec2;
    }
  | { type: "set_block_answer"; blockId: string; text: string }
  | { type: "update_block_question"; blockId: string; question: string }
  | { type: "move_block"; blockId: string; position: Vec2 }
  | { type: "delete_block"; blockId: string };

export interface QABlockCommandMeta {
  blockId?: string;
  parentBlockId?: string | null;
  statusMessage?: string;
}

export interface QABlockApplyResult {
  document: import("../shared/domain.ts").QABlockCanvasDocument;
  meta: QABlockCommandMeta;
}
