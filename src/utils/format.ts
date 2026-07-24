const PERSIAN_DIGITS: Record<string, string> = {
	"0": "۰",
	"1": "۱",
	"2": "۲",
	"3": "۳",
	"4": "۴",
	"5": "۵",
	"6": "۶",
	"7": "۷",
	"8": "۸",
	"9": "۹",
};

export const toPersianDigits = (input: string): string =>
	input.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[digit] ?? digit);

export const formatCountdown = (ms: number): string => {
	if (ms <= 0) return "اکنون";
	const totalMinutes = Math.max(1, Math.round(ms / 60000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	let text: string;
	if (hours > 0 && minutes > 0) text = `${hours} ساعت و ${minutes} دقیقه مانده`;
	else if (hours > 0) text = `${hours} ساعت مانده`;
	else text = `${minutes} دقیقه مانده`;
	return toPersianDigits(text);
};

export const formatTodayPersian = (): string => {
	try {
		const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
			weekday: "long",
			day: "numeric",
			month: "long",
		});
		const parts = formatter.formatToParts(new Date());
		const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
		const day = parts.find((part) => part.type === "day")?.value ?? "";
		const month = parts.find((part) => part.type === "month")?.value ?? "";
		return `${weekday} ${day} ${month}`.trim();
	} catch {
		return "";
	}
};
