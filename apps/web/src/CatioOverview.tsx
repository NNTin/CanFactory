import { ArrowRight } from 'lucide-react';
import { CATIO_SUBASSEMBLIES } from '@canfactory/catio';
import { CATIO_SUBASSEMBLY_TITLES } from './catioSubassemblies.ts';
import { formatHash } from './route.ts';

/**
 * The catio concept's entry (`#/concepts/catio`): the catio planner, where the whole catio is designed (#109), and the sub-assemblies'
 * pages, each showing one sub-assembly's pieces, joints and parts list.
 */
export function CatioOverview() {
  return <div className="page-heading catio-heading"><div><div className="eyebrow">CONCEPT STUDY · 01</div><h1>A little closer to the grass.</h1>
    <p>A removable window catio: a timber enclosure on the lawn, cat netting, and a tunnel from the window. Lay it out in the planner, then see how each part is built.</p>
    <nav className="catio-subassemblies" aria-label="Catio planner and sub-assemblies"><span className="eyebrow">PLAN IT · THEN THE PIECES, JOINTS AND PARTS LISTS</span>
      <div><a className="catio-planner-link" href={formatHash({ view: 'catio-planner' })}><strong>Catio planner</strong><span>lay out your garden, enclosures and tunnels</span><ArrowRight size={16} /></a>
        {CATIO_SUBASSEMBLIES.map(id => <a key={id} href={formatHash({ view: 'concepts', concept: 'catio', subassembly: id })}><strong>{CATIO_SUBASSEMBLY_TITLES[id]}</strong><span>pieces, joints and parts list</span><ArrowRight size={16} /></a>)}</div></nav></div>
    <span className="model-tag"><span /> CATIO CONCEPT</span></div>;
}
