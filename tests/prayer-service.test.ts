import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { CityService } from "../src/services/city-service";
import { PrayerService } from "../src/services/prayer-service";
import type { PrayerChimeSettings, PrayerKey } from "../src/types";

const prayerOrder: PrayerKey[] = [
	"fajr",
	"sunrise",
	"dhuhr",
	"asr",
	"sunset",
	"maghrib",
	"isha",
	"midnight",
];

describe("prayer service", () => {
	it("respects configured labels and hidden prayer times", async () => {
		const cities = await new CityService().getCities();
		const city = new CityService().getTehran(cities);
		const settings: PrayerChimeSettings = structuredClone(DEFAULT_SETTINGS);
		settings.displayedTimes.sunrise.display = false;
		settings.displayedTimes.fajr.text = "صبح سفارشی";

		const calculated = new PrayerService().calculate(city, settings);

		expect(calculated.city).toEqual(city);
		expect(calculated.items.map((item) => item.key)).not.toContain("sunrise");
		expect(calculated.items[0]).toMatchObject({ key: "fajr", label: "صبح سفارشی" });
	});

	it("keeps displayed prayer items in canonical order with finite timestamps", async () => {
		const cities = await new CityService().getCities();
		const city = new CityService().getTehran(cities);
		const calculated = new PrayerService().calculate(city, DEFAULT_SETTINGS);

		expect(calculated.items.map((item) => item.key)).toEqual(prayerOrder);
		expect(calculated.items.every((item) => Number.isFinite(item.timestamp))).toBe(true);
		expect(calculated.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("supports all configured calculation methods", async () => {
		const cities = await new CityService().getCities();
		const city = new CityService().getTehran(cities);
		const service = new PrayerService();
		const methods: PrayerChimeSettings["calculationMethod"][] = [
			"Tehran",
			"Jafari",
			"ISNA",
			"MWL",
			"UmmAlQura",
		];

		for (const calculationMethod of methods) {
			const settings: PrayerChimeSettings = {
				...structuredClone(DEFAULT_SETTINGS),
				calculationMethod,
			};
			const calculated = service.calculate(city, settings);

			expect(calculated.items).toHaveLength(prayerOrder.length);
			expect(calculated.items[0]?.time).toMatch(/^[۰-۹]{2}:[۰-۹]{2}$/);
		}
	});
});
