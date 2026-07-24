export interface IranDatasetCityRecord {
	state: string;
	province: string;
	city: string;
	latitude: string;
	longitude: string;
}

export interface IranDataset {
	DocumentElement: {
		cities: IranDatasetCityRecord[];
	};
}

export interface City extends IranDatasetCityRecord {
	id: string;
	searchText: string;
}

export type PrayerKey =
	| "fajr"
	| "sunrise"
	| "dhuhr"
	| "asr"
	| "sunset"
	| "maghrib"
	| "isha"
	| "midnight";

export interface PrayerDisplaySetting {
	display: boolean;
	text: string;
}

export type CalculationMethodType = "Tehran" | "Jafari" | "ISNA" | "MWL" | "UmmAlQura";

export interface PrayerChimeSettings {
	selectedCityId: string;
	selectedCity?: string;
	selectedprovinceCode?: string;
	displayedTimes: Record<PrayerKey, PrayerDisplaySetting>;
	warningIntervalMinutes: number;
	showStatusBar: boolean;
	calculationMethod: CalculationMethodType;
	favoriteCityIds: string[];
}

export interface PrayerTimeItem {
	key: PrayerKey;
	label: string;
	time: string;
	timestamp: number;
}

export interface CalculatedPrayerTimes {
	city: City;
	dateKey: string;
	items: PrayerTimeItem[];
}
