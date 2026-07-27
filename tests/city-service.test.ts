import { describe, expect, it } from "vitest";
import { CityService } from "../src/services/city-service";

describe("city service", () => {
	it("caches dataset loading across calls", async () => {
		const service = new CityService();
		const first = await service.getCities();
		const second = await service.getCities();

		expect(second).toBe(first);
		expect(first.length).toBeGreaterThan(800);
	});

	it("normalizes Arabic Persian variants and whitespace when searching", async () => {
		const service = new CityService();
		const cities = await service.getCities();
		const results = service.search(cities, "  جزيره كيش  ", 10);

		expect(results.some((city) => city.city === "جزیره کیش")).toBe(true);
	});

	it("honors search limits and returns initial cities for empty queries", async () => {
		const service = new CityService();
		const cities = await service.getCities();

		expect(service.search(cities, "", 3)).toEqual(cities.slice(0, 3));
		expect(service.search(cities, "ا", 2)).toHaveLength(2);
	});

	it("selects an exact city, migrates legacy Tehran, or falls back to Tehran", async () => {
		const service = new CityService();
		const cities = await service.getCities();
		const target = cities.find((city) => city.city === "مشهد");
		expect(target).toBeDefined();

		await expect(service.getSelectedCity(target?.id, undefined)).resolves.toEqual(target);
		await expect(service.getSelectedCity(undefined, "1")).resolves.toMatchObject({
			city: "تهران",
			province: "تهران",
		});
		await expect(service.getSelectedCity("missing", undefined)).resolves.toMatchObject({
			city: "تهران",
			province: "تهران",
		});
	});
});
