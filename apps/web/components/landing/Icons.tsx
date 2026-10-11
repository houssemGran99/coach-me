import type { ReactElement, ReactNode } from "react";

function Svg({ children, size }: { children: ReactNode; size?: number }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconBall = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /></Svg>;
export const IconCheck = () => <Svg><path d="M5 12l5 5L20 7" /></Svg>;
export const IconArrow = () => <Svg size={18}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconClock = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconLink = () => <Svg><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></Svg>;
export const IconPlay = () => <Svg><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></Svg>;
export const IconTimer = () => <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></Svg>;
export const IconWifi = () => <Svg><path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01" /></Svg>;
export const IconGlobe = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Svg>;
export const IconShield = () => <Svg><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L15.5 10" /></Svg>;
