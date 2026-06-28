import type { ReactElement } from "react";
import type { MatrixHistoryEntry, RecentRangeEntry } from "../shared/domain.ts";
import { MatrixHistoryNav } from "./MatrixHistoryNav.tsx";
import { MatrixRecentNav } from "./MatrixRecentNav.tsx";

export interface MatrixLeftNavProps {
  readonly recentEntries: readonly RecentRangeEntry[];
  readonly historyEntries: readonly MatrixHistoryEntry[];
  readonly selectedHistoryId: string | null;
  readonly onRecentSelect: (entry: RecentRangeEntry) => void;
  readonly onHistorySelect: (entry: MatrixHistoryEntry) => void;
}

export function MatrixLeftNav({
  recentEntries,
  historyEntries,
  selectedHistoryId,
  onRecentSelect,
  onHistorySelect,
}: MatrixLeftNavProps): ReactElement {
  return (
    <div className="matrix-left-nav-stack" data-testid="matrix-left-nav">
      <MatrixRecentNav entries={recentEntries} onSelect={onRecentSelect} />
      <MatrixHistoryNav
        entries={historyEntries}
        selectedId={selectedHistoryId}
        onSelect={onHistorySelect}
      />
    </div>
  );
}
