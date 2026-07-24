import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../src/core/settings";

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
});
