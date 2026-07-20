import { Notice, normalizePath, type PluginManifest, type Vault } from "obsidian";
import type { City, IranDatasetCityRecord } from "./types";

const DATASET_PATH = "data/iran-dataset.json";
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

	constructor(private readonly vault: Vault, private readonly manifest: PluginManifest) {}

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

	private async loadCities(): Promise<City[]> {
		try {
			const path = normalizePath(`${this.manifest.dir ?? ""}/${DATASET_PATH}`);
			const json = await this.vault.adapter.read(path);
			const parsed = JSON.parse(json) as unknown;
			const cities = this.parseDataset(parsed);
			if (cities.length === 0) {
				throw new Error("Dataset does not contain valid cities");
			}
			return cities;
		} catch (error) {
			new Notice("خطا در خواندن فایل شهرها. تهران به صورت پیش‌فرض استفاده شد.");
			return [{ id: "fallback-tehran", state: TEHRAN_CITY_NAME, province: TEHRAN_CITY_NAME, city: TEHRAN_CITY_NAME, latitude: "35.6892", longitude: "51.3890", searchText: normalizeText(`${TEHRAN_CITY_NAME} ${TEHRAN_CITY_NAME} ${TEHRAN_CITY_NAME}`) }];
		}
	}

	private parseDataset(dataset: unknown): City[] {
		if (!isRecord(dataset) || !isRecord(dataset.DocumentElement)) {
			return [];
		}
		const cities = dataset.DocumentElement.cities;
		if (!Array.isArray(cities)) {
			return [];
		}
		return cities.filter(isDatasetCity).map((city) => ({ ...city, id: cityId(city), searchText: normalizeText(`${city.city} ${city.province} ${city.state}`) }));
	}
}
