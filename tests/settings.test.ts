import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	isCalculationMethod,
	isViewMode,
	normalizeSettings,
} from "../src/core/settings";

describe("settings migration", () => {
	it("normalizes unknown plugin data safely", () => {
		const settings = normalizeSettings({
			selectedCityId: "tehran",
			showStatusBar: false,
			calculationMethod: "MWL",
			favoriteCityIds: ["a", 1, "b"],
		});

		expect(settings.selectedCityId).toBe("tehran");
		expect(settings.showStatusBar).toBe(false);
		expect(settings.calculationMethod).toBe("MWL");
		expect(settings.favoriteCityIds).toEqual(["a", "b"]);
		expect(settings.displayedTimes.fajr.text).toBe("اذان صبح");
	});

	it("returns a fresh default settings object for invalid data", () => {
		const first = normalizeSettings(null);
		const second = normalizeSettings("invalid");
		first.displayedTimes.fajr.text = "changed";
		first.favoriteCityIds.push("x");

		expect(second).toEqual(DEFAULT_SETTINGS);
		expect(second).not.toBe(DEFAULT_SETTINGS);
		expect(second.displayedTimes.fajr.text).toBe("اذان صبح");
		expect(second.favoriteCityIds).toEqual([]);
	});

	it("merges valid legacy and display settings while ignoring invalid fields", () => {
		const settings = normalizeSettings({
			selectedCity: "legacy-city",
			selectedprovinceCode: "1",
			warningIntervalMinutes: Number.POSITIVE_INFINITY,
			viewMode: "compact",
			displayedTimes: {
				fajr: { display: false, text: "سحر" },
				dhuhr: { display: "yes", text: "ظهر" },
			},
		});

		expect(settings.selectedCity).toBe("legacy-city");
		expect(settings.selectedprovinceCode).toBe("1");
		expect(settings.warningIntervalMinutes).toBe(DEFAULT_SETTINGS.warningIntervalMinutes);
		expect(settings.viewMode).toBe("compact");
		expect(settings.displayedTimes.fajr).toEqual({ display: false, text: "سحر" });
		expect(settings.displayedTimes.dhuhr).toEqual(DEFAULT_SETTINGS.displayedTimes.dhuhr);
	});

	it("validates calculation methods and view modes", () => {
		expect(isCalculationMethod("Tehran")).toBe(true);
		expect(isCalculationMethod("UmmAlQura")).toBe(true);
		expect(isCalculationMethod("Other")).toBe(false);
		expect(isViewMode("full")).toBe(true);
		expect(isViewMode("compact")).toBe(true);
		expect(isViewMode("minimal")).toBe(false);
	});
});
