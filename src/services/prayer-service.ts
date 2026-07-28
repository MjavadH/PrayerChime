import type {
	CalculatedPrayerTimes,
	City,
	PrayerChimeSettings,
	PrayerKey,
	PrayerTimeItem,
} from "../types";
import { CalculationMethod, Coordinates, PrayerTimes } from "./adhan";

const TIME_ZONE = "Asia/Tehran";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
	timeZone: TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", {
	timeZone: TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

const PRAYER_ORDER: PrayerKey[] = [
	"fajr",
	"sunrise",
	"dhuhr",
	"asr",
	"sunset",
	"maghrib",
	"isha",
	"midnight",
];

interface DateParts {
	year: number;
	month: number;
	day: number;
}

const getTehranDateParts = (date: Date): DateParts => {
	const parts = DATE_FORMATTER.format(date).split("-");
	const year = parseInt(parts[0] || "", 10);
	const month = parseInt(parts[1] || "", 10);
	const day = parseInt(parts[2] || "", 10);
	return {
		year: Number.isNaN(year) ? 1970 : year,
		month: Number.isNaN(month) ? 1 : month,
		day: Number.isNaN(day) ? 1 : day,
	};
};

const getTehranDateKey = (): string => DATE_FORMATTER.format(new Date());

const getTehranDate = (): Date => {
	const { year, month, day } = getTehranDateParts(new Date());
	return new Date(Date.UTC(year, month - 1, day));
};

const toPersianTime = (date: Date): string => TIME_FORMATTER.format(date).replace("۲۴:", "۰۰:");

export class PrayerService {
	getCurrentDateKey(): string {
		return getTehranDateKey();
	}

	calculate(city: City, settings: PrayerChimeSettings): CalculatedPrayerTimes {
		const coordinates = new Coordinates(Number(city.latitude), Number(city.longitude));
		let methodParams: import("./adhan").CalculationParameters;
		switch (settings.calculationMethod) {
			case "Jafari":
				methodParams = CalculationMethod.Jafari();
				break;
			case "ISNA":
				methodParams = CalculationMethod.ISNA();
				break;
			case "MWL":
				methodParams = CalculationMethod.MWL();
				break;
			case "UmmAlQura":
				methodParams = CalculationMethod.UmmAlQura();
				break;
			default:
				methodParams = CalculationMethod.Tehran();
				break;
		}
		const prayerTimes = new PrayerTimes(coordinates, getTehranDate(), methodParams);
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
		const allItems: PrayerTimeItem[] = PRAYER_ORDER.map((key) => ({
			key,
			label: settings.displayedTimes[key]?.text ?? key,
			time: toPersianTime(values[key]),
			timestamp: values[key].getTime(),
		}));
		const items = allItems.filter((item) => settings.displayedTimes[item.key]?.display);
		return { city, dateKey: getTehranDateKey(), items, allItems };
	}
}
