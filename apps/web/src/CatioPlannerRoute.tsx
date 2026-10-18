import { useState } from 'react';
import { CatioPlanner } from './CatioPlanner.tsx';
import { readSavedProject, SavedProjectContext } from './catioPlannerSaved.ts';

/** The planner's page: it opens the project saved in this browser (#115), or a new one when none is, or none can be read. */
export function CatioPlannerRoute() {
  const [saved] = useState(() => readSavedProject());
  return <SavedProjectContext.Provider value={saved}>{saved.project ? <CatioPlanner initial={saved.project} /> : <CatioPlanner />}</SavedProjectContext.Provider>;
}
