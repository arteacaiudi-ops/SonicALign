export const APP_VERSION = "1.0.3";

export const TARGET_CURVES = {
  FLAT: { label: "FLAT", points: [[20, 0], [20000, 0]] },
  LIVE: { label: "LIVE CONCERT", points: [[20, 6], [100, 6], [1000, 0], [10000, -3], [20000, -6]] },
  CLUB: { label: "DJ / CLUB", points: [[20, 9], [80, 9], [1000, 0], [20000, 0]] },
  SPEECH: { label: "SPEECH PRO", points: [[20, -20], [100, 0], [3000, 3], [12000, -6]] },
  OUTDOOR: { label: "OUTDOOR PA", points: [[20, 9], [120, 9], [1000, 0], [10000, 3], [20000, 0]] }
};

export const DEFAULT_TEMP = 25;