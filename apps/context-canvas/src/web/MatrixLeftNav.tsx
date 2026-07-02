import type { ReactElement } from "react";
import type { MatrixGroup, MatrixHistoryEntry } from "../shared/domain.ts";
import { MatrixGroupNav } from "./MatrixGroupNav.tsx";
import { MatrixHistoryNav } from "./MatrixHistoryNav.tsx";

export interface MatrixLeftNavProps {
  readonly groups: readonly MatrixGroup[];
  readonly historyEntries: readonly MatrixHistoryEntry[];
  readonly selectedGroupId: string | null;
  readonly selectedHistoryId: string | null;
  readonly onGroupSelect: (group: MatrixGroup) => void;
  readonly onGroupAddContext: (group: MatrixGroup) => void;
  readonly onGroupDismiss: (group: MatrixGroup) => void;
  readonly onHistorySelect: (entry: MatrixHistoryEntry) => void;
}

export function MatrixLeftNav({
  groups,
  historyEntries,
  selectedGroupId,
  selectedHistoryId,
  onGroupSelect,
  onGroupAddContext,
  onGroupDismiss,
  onHistorySelect,
}: MatrixLeftNavProps): ReactElement {
  return (
    <div className="matrix-left-nav-stack" data-testid="matrix-left-nav">
      <MatrixGroupNav
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelect={onGroupSelect}
        onAddContext={onGroupAddContext}
        onDismiss={onGroupDismiss}
      />
      <MatrixHistoryNav
        entries={historyEntries}
        selectedId={selectedHistoryId}
        onSelect={onHistorySelect}
      />
    </div>
  );
}
