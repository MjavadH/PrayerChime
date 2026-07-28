import type { IconName } from "obsidian";
import type { PrayerKey } from "../types";

export const VIEW_TYPE_PRAYER_TIMES = "prayer-times-view";
export const SEARCH_LIMIT = 80;
export const DEFAULT_WARNING_INTERVAL_MINUTES = 10;
export const ACTIVE_PRAYER_THRESHOLD_MS = 2 * 60 * 1000;
export const STATUS_BAR_UPDATE_INTERVAL_MS = 1000;
export const VIEW_UPDATE_INTERVAL_MS = 1000;
export const CELESTIAL_UPDATE_INTERVAL_MS = 60 * 1000;
export const REFRESH_SPIN_DURATION_MS = 600;

export const PRAYER_ORDER: PrayerKey[] = [
	"fajr",
	"sunrise",
	"dhuhr",
	"asr",
	"sunset",
	"maghrib",
	"isha",
	"midnight",
];

export const PRAYER_ICONS: Record<PrayerKey, IconName> = {
	fajr: "sunrise",
	sunrise: "sunrise",
	dhuhr: "sun",
	asr: "sun-dim",
	sunset: "sunset",
	maghrib: "moon-star",
	isha: "moon",
	midnight: "sparkles",
};
