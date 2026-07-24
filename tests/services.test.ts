import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { CityService } from "../src/services/city-service";
import { PrayerService } from "../src/services/prayer-service";

describe("services", () => {
	it("searches Iranian cities", async () => {
		const service = new CityService();
		const cities = await service.getCities();
		const results = service.search(cities, "تهران", 5);

		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.searchText).toContain("تهران");
	});

	it("calculates displayed prayer times", async () => {
		const cities = await new CityService().getCities();
		const city = new CityService().getTehran(cities);
		const calculated = new PrayerService().calculate(city, DEFAULT_SETTINGS);

		expect(calculated.items.map((item) => item.key)).toContain("fajr");
		expect(calculated.items[0]?.time).toMatch(/\d|[۰-۹]/);
	});
});
