import { ClipboardList } from 'lucide-react';

/**
 * The planner's top-bar "Build list" action. #115 fills it with the draft build list (and the project's local saving, import and
 * export) from the shared store (catioPlannerStore.ts); until then it says where that comes from.
 */
export function BuildListSlot() {
  return <button type="button" className="planner-build-list" disabled title="The draft build list comes with local saving and JSON import/export (#115).">
    <ClipboardList size={15} aria-hidden="true" /> Build list
  </button>;
}
