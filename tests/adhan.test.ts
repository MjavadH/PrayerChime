import { describe, expect, it } from "vitest";
import { CalculationMethod, Coordinates, PrayerTimes } from "../src/services/adhan";

const tehran = new Coordinates(35.6892, 51.389);
const date = new Date(Date.UTC(2026, 2, 21));

const tehranLocalHour = (value: Date): number =>
	value.getUTCHours() + 3.5 + value.getUTCMinutes() / 60;

describe("adhan calculations", () => {
	it("returns stable and ordered prayer times for Tehran", () => {
		const times = new PrayerTimes(tehran, date, CalculationMethod.Tehran());
		const ordered = [
			times.fajr,
			times.sunrise,
			times.dhuhr,
			times.asr,
			times.sunset,
			times.maghrib,
			times.isha,
		];

		expect(ordered.every((item) => Number.isFinite(item.getTime()))).toBe(true);
		for (let i = 1; i < ordered.length; i++) {
			expect(ordered[i].getTime()).toBeGreaterThanOrEqual(ordered[i - 1].getTime());
		}
		expect(tehranLocalHour(times.dhuhr)).toBeGreaterThan(11);
		expect(tehranLocalHour(times.dhuhr)).toBeLessThan(13);
	});

	it("maps zero maghrib angle methods to sunset", () => {
		const times = new PrayerTimes(tehran, date, CalculationMethod.MWL());

		expect(times.maghrib.getTime()).toBe(times.sunset.getTime());
	});

	it("keeps Jafari midnight after sunset and before the next fajr", () => {
		const times = new PrayerTimes(tehran, date, CalculationMethod.Jafari());

		expect(times.midnight.getTime()).toBeGreaterThan(times.sunset.getTime());
		expect(tehranLocalHour(times.midnight)).toBeGreaterThanOrEqual(0);
		expect(tehranLocalHour(times.midnight)).toBeLessThan(24);
	});
});
