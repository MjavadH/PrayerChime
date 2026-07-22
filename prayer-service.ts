import { CalculationMethod, Coordinates, PrayerTimes } from "./adhan";
import type { CalculatedPrayerTimes, City, PrayerChimeSettings, PrayerKey, PrayerTimeItem } from "./types";

const TIME_ZONE = "Asia/Tehran";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

const PRAYER_ORDER: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "sunset", "maghrib", "isha", "midnight"];

interface DateParts {
	year: number;
	month: number;
	day: number;
}

const getTehranDateParts = (date: Date): DateParts => {
	const [year, month, day] = DATE_FORMATTER.format(date).split("-").map(Number);
	return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
};

const getTehranDate = (): Date => {
	const { year, month, day } = getTehranDateParts(new Date());
	return new Date(Date.UTC(year, month - 1, day));
};

const toPersianTime = (date: Date): string => TIME_FORMATTER.format(date).replace("۲۴:", "۰۰:");

export class PrayerService {
	calculate(city: City, settings: PrayerChimeSettings): CalculatedPrayerTimes {
		const coordinates = new Coordinates(Number(city.latitude), Number(city.longitude));
		const prayerTimes = new PrayerTimes(coordinates, getTehranDate(), CalculationMethod.Tehran());
		const values: Record<PrayerKey, Date> = {
			fajr: prayerTimes.fajr,
			sunrise: prayerTimes.sunrise,
			dhuhr: prayerTimes.dhuhr,
			asr: prayerTimes.asr,
			sunset: prayerTimes.sunset,
			maghrib: prayerTimes.maghrib,
			isha: prayerTimes.isha,
			midnight: prayerTimes.midnight,
		};
		const items: PrayerTimeItem[] = [];
		for (const key of PRAYER_ORDER) {
			const display = settings.displayedTimes[key];
			if (display?.display) {
				items.push({ key, label: display.text, time: toPersianTime(values[key]), timestamp: values[key].getTime() });
			}
		}
		return { city, dateKey: DATE_FORMATTER.format(new Date()), items };
	}

	millisecondsUntilNextTehranMidnight(): number {
		const now = new Date();
		const { year, month, day } = getTehranDateParts(now);
		const nextMidnightUtc = Date.UTC(year, month - 1, day + 1, -3, -30, 1);
		return Math.max(1000, nextMidnightUtc - now.getTime());
	}
}
