const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

export const APP_VERSION = "1.0.3k"; 

export const TARGET_CURVES = {
  FLAT: { label: "FLAT (0dB)", points: [[20, 0], [20000, 0]] },
  LIVE: { label: "LIVE CONCERT", points: [[20, 6], [100, 6], [1000, 0], [10000, -3], [20000, -6]] },
  CLUB: { label: "DJ / CLUB", points: [[20, 9], [80, 9], [1000, 0], [20000, 0]] },
  SPEECH: { label: "SPEECH PRO", points: [[20, -20], [100, 0], [3000, 3], [12000, -6]] },
  OUTDOOR: { label: "OUTDOOR PA", points: [[20, 9], [120, 9], [1000, 0], [10000, 3], [20000, 0]] }
};

export const DEFAULT_TEMP = 25;

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

const getAppParams = () => {
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	}
}

export const appParams = { ...getAppParams() };
