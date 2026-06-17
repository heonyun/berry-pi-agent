import type { CompiledPromptContext } from "../../shared/compiler.ts";
import type {
  ContextCanvasDocument,
  FeedbackState,
  NodeKind,
  StanceBand,
  Vec2,
} from "../../shared/domain.ts";

/** YAML frontmatter for a projected node markdown file. */
export interface NodeProjectionFrontmatter {
  type: NodeKind;
  title: string;
  description: string;
  canvas: string;
  group: string;
  position: Vec2;
  stance: StanceBand;
  feedback?: FeedbackState;
  lineage_parent: string | null;
  context_refs: string[];
  active_version_id?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ProjectionError {
  code: string;
  message: string;
  path?: string;
}

export interface ProjectResult {
  pathsWritten: string[];
  errors: ProjectionError[];
}

export interface LoadResult {
  document?: ContextCanvasDocument;
  warnings: string[];
  errors: string[];
}

export interface ProjectOptions {
  includeCompiled?: boolean;
  compiledByPromptId?: Map<string, CompiledPromptContext>;
  writeCanvasSidecar?: boolean;
}
