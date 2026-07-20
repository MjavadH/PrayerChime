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

export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha" | "midnight";

export interface PrayerDisplaySetting {
	display: boolean;
	text: string;
}

export interface PrayerChimeSettings {
	selectedCityId: string;
	selectedCity?: string;
	selectedprovinceCode?: string;
	displayedTimes: Record<PrayerKey, PrayerDisplaySetting>;
}

export interface PrayerTimeItem {
	key: PrayerKey;
	label: string;
	time: string;
}

export interface CalculatedPrayerTimes {
	city: City;
	dateKey: string;
	items: PrayerTimeItem[];
}
