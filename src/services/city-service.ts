import { Notice } from "obsidian";
import type { City, IranDatasetCityRecord } from "../types";
import iranDataset from "../data/iran-dataset.json";

const TEHRAN_CITY_NAME = "تهران";

const normalizeText = (value: string): string => value.normalize("NFKC").replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa-IR");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isDatasetCity = (value: unknown): value is IranDatasetCityRecord => {
	if (!isRecord(value)) {
		return false;
	}
	return typeof value.state === "string" && typeof value.province === "string" && typeof value.city === "string" && typeof value.latitude === "string" && typeof value.longitude === "string" && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
};

const cityId = (city: IranDatasetCityRecord): string => `${city.state}|${city.province}|${city.city}|${city.latitude}|${city.longitude}`;

export class CityService {
	private citiesPromise: Promise<City[]> | null = null;

	constructor() {}

	getCities(): Promise<City[]> {
		this.citiesPromise ??= this.loadCities();
		return this.citiesPromise;
	}

	async getSelectedCity(selectedCityId: string | undefined, legacyProvinceCode: string | undefined): Promise<City> {
		const cities = await this.getCities();
		const selected = selectedCityId ? cities.find((city) => city.id === selectedCityId) : undefined;
		if (selected) {
			return selected;
		}
		const legacy = legacyProvinceCode === "1" ? cities.find((city) => city.city === TEHRAN_CITY_NAME && city.province === TEHRAN_CITY_NAME) : undefined;
		return legacy ?? this.getTehran(cities);
	}

	getTehran(cities: City[]): City {
		return cities.find((city) => city.city === TEHRAN_CITY_NAME && city.province === TEHRAN_CITY_NAME) ?? cities[0];
	}

	search(cities: City[], query: string, limit: number): City[] {
		const normalizedQuery = normalizeText(query);
		if (!normalizedQuery) {
			return cities.slice(0, limit);
		}
		const results: City[] = [];
		for (const city of cities) {
			if (city.searchText.includes(normalizedQuery)) {
				results.push(city);
				if (results.length >= limit) {
					break;
				}
			}
		}
		return results;
	}

	private loadCities(): Promise<City[]> {
		try {
			const cities = this.parseDataset(iranDataset);

			if (cities.length === 0) {
				throw new Error("Dataset does not contain valid cities");
			}
			return Promise.resolve(cities);
		} catch {
			new Notice("خطا در خواندن اطلاعات شهرها.");

			return Promise.resolve([{
				id: "fallback-tehran",
				state: "تهران",
				province: "تهران",
				city: "تهران",
				latitude: "35.6892",
				longitude: "51.3890",
				searchText: normalizeText("تهران تهران تهران")
			}]);
		}
	}

	private parseDataset(dataset: unknown): City[] {
		if (!isRecord(dataset) || !isRecord(dataset.DocumentElement) || !Array.isArray(dataset.DocumentElement.cities)) {
			return [];
		}

		return dataset.DocumentElement.cities.filter(isDatasetCity).map((city) => ({
			...city,
			id: cityId(city),
			searchText: normalizeText(`${city.city} ${city.province} ${city.state}`)
		}));
	}
}
