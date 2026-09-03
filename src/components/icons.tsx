import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const I = ({ size = 18, children, ...rest }: P & { children: React.ReactNode }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...rest}
  >
    {children}
  </svg>
);

export const Logo = (p: P) => (
  <I {...p} strokeWidth={1.9}>
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14.5 3.5V8H19" />
    <path d="M9 12.5l2 2 4-4.5" />
    <path d="M9 17h6.5" />
  </I>
);
export const IconScan = (p: P) => (
  <I {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8m8 0h2.5A1.5 1.5 0 0 1 20 5.5V8m0 8v2.5a1.5 1.5 0 0 1-1.5 1.5H16m-8 0H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M3.5 12h17" /></I>
);
export const IconForge = (p: P) => (
  <I {...p}><path d="M4 15.5 12 4l8 11.5" /><path d="M7.5 15.5h9L14 19h-4z" /><path d="M12 4v4" /></I>
);
export const IconMap = (p: P) => (
  <I {...p}><circle cx="5.5" cy="12" r="2.4" /><circle cx="18.5" cy="5.5" r="2.4" /><circle cx="18.5" cy="18.5" r="2.4" /><path d="M7.8 10.9l8.4-4.2M7.8 13.1l8.4 4.2" /></I>
);
export const IconPress = (p: P) => (
  <I {...p}><path d="M5 4h14M5 20h14" /><path d="M12 7v10m0-10-3 3m3-3 3 3m-3 7-3-3m3 3 3-3" /></I>
);
export const IconShield = (p: P) => (
  <I {...p}><path d="M12 3.5 5 6v6c0 4.4 3 7.4 7 8.5 4-1.1 7-4.1 7-8.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></I>
);
export const IconSync = (p: P) => (
  <I {...p}><path d="M7 8h10.5a2.5 2.5 0 0 1 0 5H9m-2-5 3-3M7 8l3 3" /><path d="M17 16H6.5a2.5 2.5 0 0 1 0-5H15m2 5-3-3m3 3-3 3" /></I>
);
export const IconTree = (p: P) => (
  <I {...p}><rect x="3.5" y="4" width="7" height="5" rx="1.2" /><rect x="13.5" y="15" width="7" height="5" rx="1.2" /><rect x="13.5" y="8" width="7" height="5" rx="1.2" /><path d="M7 9v8.5a2 2 0 0 0 2 2h4.5M7 9v1.5a2 2 0 0 0 2 2h4.5" /></I>
);
export const IconLock = (p: P) => (
  <I {...p}><rect x="5.5" y="10.5" width="13" height="9.5" rx="1.8" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14.5v2" /></I>
);
export const IconUnlock = (p: P) => (
  <I {...p}><rect x="5.5" y="10.5" width="13" height="9.5" rx="1.8" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2" /><path d="M12 14.5v2" /></I>
);
export const IconKey = (p: P) => (
  <I {...p}><circle cx="8" cy="14.5" r="4" /><path d="M11 11.5 19.5 3M16 6.5l2.5 2.5M13.5 9l2 2" /></I>
);
export const IconZap = (p: P) => (
  <I {...p}><path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" /></I>
);
export const IconTrash = (p: P) => (
  <I {...p}><path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6" /><path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6A1.5 1.5 0 0 0 16.5 20l1-13.5" /><path d="M10 10.5v7m4-7v7" /></I>
);
export const IconCheck = (p: P) => <I {...p}><path d="M4.5 12.5 10 18 19.5 6.5" /></I>;
export const IconX = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconSun = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></I>
);
export const IconMoon = (p: P) => <I {...p}><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" /></I>;
export const IconOled = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></I>
);
export const IconContrast = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" stroke="none" /></I>
);
export const IconDownload = (p: P) => <I {...p}><path d="M12 3.5v11m0 0 4-4m-4 4-4-4" /><path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" /></I>;
export const IconUpload = (p: P) => <I {...p}><path d="M12 14.5v-11m0 0 4 4m-4-4-4 4" /><path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" /></I>;
export const IconEye = (p: P) => (
  <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></I>
);
export const IconEdit = (p: P) => <I {...p}><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z" /><path d="M14.5 7 17 9.5" /></I>;
export const IconLayers = (p: P) => (
  <I {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m4.5 12.5 7.5 4 7.5-4M4.5 16.5l7.5 4 7.5-4" /></I>
);
export const IconAlert = (p: P) => (
  <I {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5m0 2.6v.1" /></I>
);
export const IconRadar = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12 18 6.5" /><circle cx="15" cy="14.5" r="1.1" fill="currentColor" stroke="none" /></I>
);
export const IconHistory = (p: P) => (
  <I {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" /><path d="M3.5 3.5v5h5" /><path d="M12 7.5V12l3.5 2" /></I>
);
export const IconFile = (p: P) => (
  <I {...p}><path d="M6 3.5h8.5L19 8v12.5H6z" /><path d="M14.5 3.5V8H19" /></I>
);
export const IconChevron = (p: P) => <I {...p}><path d="m9 5.5 6.5 6.5L9 18.5" /></I>;
export const IconGauge = (p: P) => (
  <I {...p}><path d="M4 16a8.5 8.5 0 1 1 16 0" /><path d="M12 16l4-6" /><path d="M4 20h16" /></I>
);
export const IconSpark = (p: P) => (
  <I {...p}><path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z" /><path d="M18.5 15.5c.3 1.8.9 2.4 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.3 2.4-.9 2.7-2.7z" /></I>
);
export const IconFingerprint = (p: P) => (
  <I {...p}><path d="M7 19.5c-1.5-2-2.5-4.5-2.5-7a7.5 7.5 0 0 1 12.8-5.3" /><path d="M19.5 11.5c0 3-.5 5.5-1.5 8" /><path d="M15.9 4.6A7.4 7.4 0 0 1 16.5 8c0 4-1 7.5-3 10.5" /><path d="M12 8.5c0 4.5-1.2 8-3.5 10.9" /><path d="M8.5 12a3.5 3.5 0 0 1 3.4-3.5" /></I>
);
export const IconCopy = (p: P) => (
  <I {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="1.5" /><path d="M5.5 15h-.7A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7" /></I>
);
export const IconBroom = (p: P) => (
  <I {...p}><path d="m13.5 3.5-3 7" /><path d="M5 20.5c.5-4.5 2.5-7.5 5.5-9.5 2.2 2.6 3.4 5.5 3.5 9.5z" /><path d="M8 14.5 5.5 12" /></I>
);
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconSearch = (p: P) => (
  <I {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="m15.5 15.5 4.5 4.5" /></I>
);
export const IconTerminal = (p: P) => (
  <I {...p}><rect x="3" y="4.5" width="18" height="15" rx="1.8" /><path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" /></I>
);
