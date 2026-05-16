// Importa o ficheiro version.json que está na raiz
import versionData from '../../version.json';

// Lê a versão dinamicamente
export const APP_VERSION = versionData.version; 

export const ISO_31_BANDS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

export const TARGET_CURVES = {
  FLAT: { label: "FLAT (0dB)", values: new Array(31).fill(0) },
  LIVE: { label: "LIVE CONCERT", values: [6,6,6,6,6,5,4,3,2,1,0,0,0,0,0,0,0,-1,-2,-3,-4,-4,-5,-5,-6,-6,-6,-6,-6,-6,-6] },
  CLUB: { label: "DJ / CLUB", values: [9,9,9,9,8,7,5,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,2,2,2,2] },
  SPEECH: { label: "SPEECH PRO", values: [-15,-12,-10,-8,-4,0,2,3,4,4,3,2,1,0,0,0,0,1,2,3,4,4,3,1,-2,-4,-6,-10,-15,-20,-25] }
};

export const DEFAULT_TEMP = 25;
const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;
const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) return defaultValue;
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) { storage.setItem(storageKey, searchParam); return searchParam; }
	if (defaultValue) { storage.setItem(storageKey, defaultValue); return defaultValue; }
	const storedValue = storage.getItem(storageKey);
	return storedValue || null;
}

export const appParams = {
  appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
  token: getAppParamValue("access_token", { removeFromUrl: true }),
  fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
  functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
  appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
};
