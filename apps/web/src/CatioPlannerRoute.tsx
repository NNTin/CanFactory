import { useState } from 'react';
import { CatioPlanner } from './CatioPlanner.tsx';
import { projectSession, ProjectSessionContext } from './catioPlannerSaved.ts';

/** The planner's page: the project open in this tab (#117), the one sub-assemblies' views show too; first opened from storage (#115). */
export function CatioPlannerRoute() {
  const [session] = useState(projectSession);
  return <ProjectSessionContext.Provider value={session}><CatioPlanner store={session.store} /></ProjectSessionContext.Provider>;
}
