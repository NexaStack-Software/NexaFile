import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * NexaFile-Wortmarke als Inline-SVG.
 * Verwendet `currentColor`, d. h. die Farbe wird vom CSS-Kontext vererbt
 * (z. B. `className="text-primary"` oder `text-foreground`).
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" fill="currentColor" {...props}>
      {/* „N"-Icon links */}
      <rect x="0" y="15" width="90" height="90" rx="18" fill="currentColor" />
      <text
        x="45"
        y="85"
        textAnchor="middle"
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="600"
        fontSize="70"
        fill="#fdf9f3"
      >
        N
      </text>

      {/* Wortmarke „NexaFile" */}
      <text
        x="110"
        y="80"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="700"
        fontSize="58"
        letterSpacing="-0.02em"
      >
        NexaFile
      </text>
    </svg>
  );
};
