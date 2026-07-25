import type { PrayerChimeSettings, PrayerDisplaySetting, PrayerKey, ViewMode } from "../types";

const PRAYER_KEYS: PrayerKey[] = [
	"fajr",
	"sunrise",
	"dhuhr",
	"asr",
	"sunset",
	"maghrib",
	"isha",
	"midnight",
];

export const DEFAULT_SETTINGS: PrayerChimeSettings = {
	selectedCityId: "",
	displayedTimes: {
		fajr: { display: true, text: "اذان صبح" },
		sunrise: { display: true, text: "طلوع آفتاب" },
		dhuhr: { display: true, text: "اذان ظهر" },
		asr: { display: true, text: "اذان عصر" },
		sunset: { display: true, text: "غروب آفتاب" },
		maghrib: { display: true, text: "اذان مغرب" },
		isha: { display: true, text: "اذان عشاء" },
		midnight: { display: true, text: "نیمه‌شب شرعی" },
	},
	warningIntervalMinutes: 10,
	showStatusBar: true,
	calculationMethod: "Tehran",
	favoriteCityIds: [],
	viewMode: "full",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isPrayerDisplaySetting = (value: unknown): value is PrayerDisplaySetting =>
	isRecord(value) && typeof value.display === "boolean" && typeof value.text === "string";

export const isCalculationMethod = (
	value: unknown,
): value is PrayerChimeSettings["calculationMethod"] =>
	value === "Tehran" ||
	value === "Jafari" ||
	value === "ISNA" ||
	value === "MWL" ||
	value === "UmmAlQura";

export const isViewMode = (value: unknown): value is ViewMode =>
	value === "full" || value === "compact";

export const normalizeSettings = (loadedData: unknown): PrayerChimeSettings => {
	if (!isRecord(loadedData)) {
		return structuredClone(DEFAULT_SETTINGS);
	}

	const settings = structuredClone(DEFAULT_SETTINGS);

	if (typeof loadedData.selectedCityId === "string")
		settings.selectedCityId = loadedData.selectedCityId;
	if (typeof loadedData.selectedCity === "string") settings.selectedCity = loadedData.selectedCity;
	if (typeof loadedData.selectedprovinceCode === "string")
		settings.selectedprovinceCode = loadedData.selectedprovinceCode;
	if (
		typeof loadedData.warningIntervalMinutes === "number" &&
		Number.isFinite(loadedData.warningIntervalMinutes)
	)
		settings.warningIntervalMinutes = loadedData.warningIntervalMinutes;
	if (typeof loadedData.showStatusBar === "boolean")
		settings.showStatusBar = loadedData.showStatusBar;
	if (isCalculationMethod(loadedData.calculationMethod))
		settings.calculationMethod = loadedData.calculationMethod;
	if (isViewMode(loadedData.viewMode)) settings.viewMode = loadedData.viewMode;
	if (Array.isArray(loadedData.favoriteCityIds))
		settings.favoriteCityIds = loadedData.favoriteCityIds.filter(
			(id): id is string => typeof id === "string",
		);

	if (isRecord(loadedData.displayedTimes)) {
		for (const key of PRAYER_KEYS) {
			const value = loadedData.displayedTimes[key];
			if (isPrayerDisplaySetting(value)) settings.displayedTimes[key] = value;
		}
	}

	return settings;
};
