import { describe, expect, it } from "vitest";
import { formatCountdown, toPersianDigits } from "../src/utils/format";

describe("format utilities", () => {
	it("converts Latin digits to Persian digits", () => {
		expect(toPersianDigits("12:30")).toBe("۱۲:۳۰");
	});

	it("formats countdown text", () => {
		expect(formatCountdown(90 * 60 * 1000)).toBe("۱ ساعت و ۳۰ دقیقه مانده");
	});
});
