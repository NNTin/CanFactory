/** Schematic of jhappone's token and two-piece spring clamp; the live viewer uses the verified STEP conversion. */
export function TrolleyTokenIllustration() {
  return <svg viewBox="0 0 250 210" role="img" aria-label="Trolley token with spring-operated shopping-list clamp" className="trolley-token-illustration">
    <title>jhappone’s trolley token and shopping-list holder</title>
    <text x="14" y="22" fill="#52665b" fontSize="8" letterSpacing="1">TOKEN + LIST CLAMP</text>
    <g transform="translate(55 107) rotate(-18) scale(2.35)" stroke="#35575d" strokeWidth=".5" strokeLinejoin="round">
      <ellipse cx="19" cy="6" rx="31" ry="13" fill="#dce5df" stroke="none" />
      <path d="M8,-8 H29 Q33,-8 33,-15 H38.5 Q40,-15 40,-13.5 V13.5 Q40,15 38.5,15 H34.5 Q33,15 33,13.5 V11.5 Q33,7.5 29,7.5 H8 Z" fill="#497c85" />
      <circle r="11.625" fill="#86b0ad" />
      <circle r="8.5" fill="none" stroke="#c0d8cd" strokeWidth=".35" />
      <text x="0" y="2" textAnchor="middle" fill="#35575d" stroke="none" fontSize="5">€</text>
      <path d="M38,-10 H59 V10 H38 Z" fill="#fffefa" stroke="#b8b6a7" strokeWidth=".35" />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M44,${-6 + i * 3.5} h11`} stroke="#b8b6a7" strokeWidth=".35" />)}
      <path d="M15,-6 Q15,-7.5 16.5,-7.5 H29 Q33,-7.5 33,-11.5 V-13.5 Q33,-15 34.5,-15 H38.5 Q40,-15 40,-13.5 V13.5 Q40,15 38.5,15 H34.5 Q33,15 33,13.5 V11.5 Q33,7.5 29,7.5 H16.5 Q15,7.5 15,6 Z" fill="#e5d9bb" />
      <path d="M25,-8.5 V8.5" stroke="#35575d" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M21,-3 Q20,0 21,3 M23,-3 Q22,0 23,3 M25,-3 Q24,0 25,3 M27,-3 Q26,0 27,3" fill="none" stroke="#62777a" strokeWidth=".55" />
    </g>
    <text x="125" y="179" textAnchor="middle" fill="#52665b" fontSize="8">Two printed parts · metal spring + axle</text>
    <text x="125" y="195" textAnchor="middle" fill="#728078" fontSize="7">jhappone · CC BY 4.0</text>
  </svg>;
}
