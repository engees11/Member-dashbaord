// Chhote stroke icons (koi extra library nahi chahiye)
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const Svg = ({ size = 22, width = 2, children }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={width} {...base}>{children}</svg>
);

export const IconUsers = (p) => (
    <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
export const IconUserPlus = (p) => (
    <Svg width={2.2} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></Svg>
);
export const IconGrid = (p) => (
    <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);
export const IconUpload = (p) => (
    <Svg width={2.2} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></Svg>
);
export const IconBell = (p) => (
    <Svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>
);
export const IconLogout = (p) => (
    <Svg width={2.2} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
);
export const IconClock = (p) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconCheck = (p) => (
    <Svg width={2.4} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
export const IconX = (p) => (
    <Svg width={2.4} {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Svg>
);
export const IconHourglass = (p) => (
    <Svg {...p}><path d="M6 3h12" /><path d="M6 21h12" /><path d="M7 3v3a5 5 0 0 0 10 0V3" /><path d="M7 21v-3a5 5 0 0 1 10 0v3" /></Svg>
);
export const IconFile = (p) => (
    <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></Svg>
);
export const IconStar = (p) => (
    <Svg {...p}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Svg>
);
export const IconArrowLeft = (p) => (
    <Svg width={2.2} {...p}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></Svg>
);
