export class Coordinates {
	constructor(public readonly latitude: number, public readonly longitude: number) {}
}

export interface CalculationParameters {
	fajrAngle: number;
	ishaAngle: number;
	maghribAngle: number;
	midnightMode: "standard" | "jafari";
}

export class CalculationMethod {
	static Tehran(): CalculationParameters {
		return {
			fajrAngle: 17.7,
			ishaAngle: 14,
			maghribAngle: 4.5,
			midnightMode: "jafari",
		};
	}
}

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;
const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;
const normalizeHours = (hours: number): number => ((hours % 24) + 24) % 24;

const dayOfYear = (date: Date): number => {
	const start = Date.UTC(date.getUTCFullYear(), 0, 0);
	const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	return Math.floor((current - start) / 86400000);
};

const solarDeclination = (meanAnomaly: number, eclipticLongitude: number): number => {
	return radiansToDegrees(Math.asin(Math.sin(degreesToRadians(eclipticLongitude)) * Math.sin(degreesToRadians(23.44))));
};

const equationOfTime = (meanAnomaly: number, eclipticLongitude: number): number => {
	const y = Math.tan(degreesToRadians(23.44 / 2)) ** 2;
	const l0 = normalizeDegrees(eclipticLongitude - 1.9148 * Math.sin(degreesToRadians(meanAnomaly)) - 0.02 * Math.sin(degreesToRadians(2 * meanAnomaly)));
	const e = 0.016708634;
	const value = y * Math.sin(2 * degreesToRadians(l0)) - 2 * e * Math.sin(degreesToRadians(meanAnomaly)) + 4 * e * y * Math.sin(degreesToRadians(meanAnomaly)) * Math.cos(2 * degreesToRadians(l0)) - 0.5 * y * y * Math.sin(4 * degreesToRadians(l0)) - 1.25 * e * e * Math.sin(2 * degreesToRadians(meanAnomaly));
	return radiansToDegrees(value) * 4;
};

const hourAngle = (latitude: number, declination: number, altitude: number): number => {
	const numerator = Math.sin(degreesToRadians(altitude)) - Math.sin(degreesToRadians(latitude)) * Math.sin(degreesToRadians(declination));
	const denominator = Math.cos(degreesToRadians(latitude)) * Math.cos(degreesToRadians(declination));
	const value = Math.max(-1, Math.min(1, numerator / denominator));
	return radiansToDegrees(Math.acos(value)) / 15;
};

const dateFromLocalHours = (date: Date, hours: number): Date => {
	const normalized = normalizeHours(hours);
	const wholeHours = Math.floor(normalized);
	const minutesFloat = (normalized - wholeHours) * 60;
	const wholeMinutes = Math.floor(minutesFloat);
	const seconds = Math.round((minutesFloat - wholeMinutes) * 60);
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), wholeHours - 3, wholeMinutes - 30, seconds));
};

export class PrayerTimes {
	readonly fajr: Date;
	readonly sunrise: Date;
	readonly dhuhr: Date;
	readonly asr: Date;
	readonly sunset: Date;
	readonly maghrib: Date;
	readonly isha: Date;
	readonly midnight: Date;

	constructor(coordinates: Coordinates, date: Date, parameters: CalculationParameters) {
		const n = dayOfYear(date);
		const meanAnomaly = normalizeDegrees(357.5291 + 0.98560028 * n);
		const center = 1.9148 * Math.sin(degreesToRadians(meanAnomaly)) + 0.02 * Math.sin(degreesToRadians(2 * meanAnomaly)) + 0.0003 * Math.sin(degreesToRadians(3 * meanAnomaly));
		const eclipticLongitude = normalizeDegrees(meanAnomaly + center + 102.9372 + 180);
		const declination = solarDeclination(meanAnomaly, eclipticLongitude);
		const eqTime = equationOfTime(meanAnomaly, eclipticLongitude);
		const dhuhrHours = 12 + 3.5 - coordinates.longitude / 15 - eqTime / 60;
		const sunriseAngle = -0.833;
		const sunriseOffset = hourAngle(coordinates.latitude, declination, sunriseAngle);
		const fajrOffset = hourAngle(coordinates.latitude, declination, -parameters.fajrAngle);
		const maghribOffset = hourAngle(coordinates.latitude, declination, -parameters.maghribAngle);
		const ishaOffset = hourAngle(coordinates.latitude, declination, -parameters.ishaAngle);
		const asrAltitude = radiansToDegrees(Math.atan(1 / (1 + Math.tan(degreesToRadians(Math.abs(coordinates.latitude - declination))))));
		const asrOffset = hourAngle(coordinates.latitude, declination, asrAltitude);
		this.dhuhr = dateFromLocalHours(date, dhuhrHours);
		this.sunrise = dateFromLocalHours(date, dhuhrHours - sunriseOffset);
		this.sunset = dateFromLocalHours(date, dhuhrHours + sunriseOffset);
		this.fajr = dateFromLocalHours(date, dhuhrHours - fajrOffset);
		this.asr = dateFromLocalHours(date, dhuhrHours + asrOffset);
		this.maghrib = dateFromLocalHours(date, dhuhrHours + maghribOffset);
		this.isha = dateFromLocalHours(date, dhuhrHours + ishaOffset);
		const nightStart = dhuhrHours + sunriseOffset;
		const nextFajr = dhuhrHours + 24 - fajrOffset;
		this.midnight = dateFromLocalHours(date, nightStart + (nextFajr - nightStart) / 2);
	}
}
