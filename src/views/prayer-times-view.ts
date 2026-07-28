import type { IconName, WorkspaceLeaf } from "obsidian";
import { ItemView, Menu, Notice, setIcon } from "obsidian";
import {
	ACTIVE_PRAYER_THRESHOLD_MS,
	CELESTIAL_UPDATE_INTERVAL_MS,
	PRAYER_ICONS,
	REFRESH_SPIN_DURATION_MS,
	VIEW_TYPE_PRAYER_TIMES,
	VIEW_UPDATE_INTERVAL_MS,
} from "../core/constants";
import type PrayerChimePlugin from "../main";
import type { CalculatedPrayerTimes, PrayerKey, PrayerTimeItem } from "../types";
import { formatCountdown, formatTodayPersian, toPersianDigits } from "../utils/format";
import { CelestialSky } from "./celestial-sky";

export class PrayerTimesView extends ItemView {
	private readonly plugin: PrayerChimePlugin;
	private timerId: number | null = null;
	private lastCalculatedTimes: CalculatedPrayerTimes | null = null;
	private itemElements: Map<PrayerKey, HTMLElement> = new Map();
	private nextValueEl: HTMLElement | null = null;
	private nextLabelEl: HTMLElement | null = null;
	private nextCountdownEl: HTMLElement | null = null;
	private headerEl: HTMLElement | null = null;
	private sky: CelestialSky | null = null;
	private lastCelestialUpdateAt: number | null = null;
	private currentTheme: "morning" | "day" | "evening" | "night" | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PrayerChimePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PRAYER_TIMES;
	}

	getDisplayText(): string {
		return "PrayerChime";
	}

	getIcon(): IconName {
		return "sparkles";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.updateViewMode();
		this.startTimer();
	}

	async onClose(): Promise<void> {
		this.stopTimer();
		this.sky?.destroy();
		this.sky = null;
	}

	public updateViewMode(): void {
		const isCompact = this.plugin.settings.viewMode === "compact";
		this.contentEl.toggleClass("is-compact", isCompact);
	}

	refresh(): void {
		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1];
		if (!container?.instanceOf(HTMLElement)) return;

		container.empty();
		container.addClass("prayer-chime-view");

		void this.plugin.cities.getCities().then((cities) => {
			const city =
				cities.find((c) => c.id === this.plugin.settings.selectedCityId) ??
				this.plugin.cities.getTehran(cities);
			const calculated = this.plugin.prayer.calculate(city, this.plugin.settings);
			this.lastCalculatedTimes = calculated;
			this.lastCelestialUpdateAt = null;

			/* Header */
			this.headerEl = container.createDiv({ cls: "pc-header" });
			this.sky?.destroy();
			this.sky = new CelestialSky(this.headerEl);

			const initialTheme = this.getThemePeriod(Date.now(), calculated);
			this.headerEl.addClass(`theme-${initialTheme}`);
			this.currentTheme = initialTheme;

			const topRow = this.headerEl.createDiv({ cls: "pc-header__top" });
			const titleWrap = topRow.createDiv({ cls: "pc-header__title-wrap" });
			titleWrap.createDiv({ cls: "pc-header__eyebrow", text: "اوقات شرعی" });
			const favoriteIds = this.plugin.settings.favoriteCityIds || [];
			const hasFavorites = favoriteIds.length > 1;

			const cityTitleEl = titleWrap.createEl("h3", {
				cls: `pc-header__title${hasFavorites ? " is-clickable" : ""}`,
			});

			const cityNameStr =
				city.city === city.province ? city.city : `${city.city}، ${city.province}`;
			cityTitleEl.createSpan({ text: cityNameStr });

			if (hasFavorites) {
				const iconEl = cityTitleEl.createSpan({ cls: "pc-header__chevron" });
				setIcon(iconEl, "chevron-down");

				cityTitleEl.addEventListener("click", (event: MouseEvent) => {
					void (async () => {
						const menu = new Menu();
						const allCities = await this.plugin.cities.getCities();
						const limitedFavorites = favoriteIds.slice(0, 10);

						for (const cityId of limitedFavorites) {
							const cityObj = allCities.find((c) => c.id === cityId);
							if (!cityObj) continue;

							const fCityName =
								cityObj.city === cityObj.province
									? cityObj.city
									: `${cityObj.city}، ${cityObj.province}`;

							const isSelected = this.plugin.settings.selectedCityId === cityId;

							menu.addItem((item) => {
								item
									.setTitle(fCityName)
									.setChecked(isSelected)
									.onClick(async () => {
										if (isSelected) return;
										this.plugin.settings.selectedCityId = cityId;
										await this.plugin.saveSettings();
										this.refresh();
									});
							});
						}

						menu.showAtMouseEvent(event);
					})().catch((err: unknown) => {
						new Notice(err instanceof Error ? err.message : String(err));
					});
				});
			}

			const refreshBtn = topRow.createEl("button", {
				cls: "pc-header__refresh",
				attr: { type: "button", "aria-label": "به‌روزرسانی" },
			});
			setIcon(refreshBtn, "refresh-cw");
			this.registerDomEvent(refreshBtn, "click", () => {
				refreshBtn.addClass("is-spinning");
				this.refresh();
				window.setTimeout(() => refreshBtn.removeClass("is-spinning"), REFRESH_SPIN_DURATION_MS);
			});

			this.headerEl.createDiv({
				cls: "pc-header__date",
				text: formatTodayPersian(),
			});

			const nextWrap = this.headerEl.createDiv({ cls: "pc-header__next" });
			const nextTopRow = nextWrap.createDiv({ cls: "pc-header__next-row" });
			this.nextLabelEl = nextTopRow.createSpan({
				cls: "pc-header__next-label",
				text: "وقت بعدی",
			});
			this.nextValueEl = nextTopRow.createSpan({
				cls: "pc-header__next-value",
				text: "—",
			});
			this.nextCountdownEl = nextWrap.createDiv({
				cls: "pc-header__next-countdown",
				text: "",
			});

			/* List */
			const listEl = container.createDiv({ cls: "pc-list" });
			this.itemElements.clear();

			if (calculated.items.length === 0) {
				container.createDiv({
					cls: "pc-empty",
					text: "هیچ وقتی برای نمایش انتخاب نشده است.",
				});
			} else {
				for (const item of calculated.items) {
					const itemEl = listEl.createDiv({ cls: "pc-item" });
					this.itemElements.set(item.key, itemEl);

					const left = itemEl.createDiv({ cls: "pc-item__left" });
					const iconEl = left.createSpan({ cls: "pc-item__icon" });
					setIcon(iconEl, PRAYER_ICONS[item.key]);
					left.createSpan({ cls: "pc-item__label", text: item.label });

					const timeStr = toPersianDigits(item.time);
					itemEl.createSpan({ cls: "pc-item__time", text: timeStr });

					itemEl.addEventListener("contextmenu", (event: MouseEvent) => {
						event.preventDefault();
						const menu = new Menu();

						menu.addItem((menuItem) => {
							menuItem
								.setTitle("کپی")
								.setIcon("copy")
								.onClick(async () => {
									const textToCopy = `${item.label}: ${timeStr}`;
									try {
										await navigator.clipboard.writeText(textToCopy);
										new Notice(`کپی شد: ${textToCopy}`);
									} catch {
										new Notice("خطا در کپی کردن اطلاعات");
									}
								});
						});

						menu.showAtMouseEvent(event);
					});
				}
			}

			this.updateItemStatuses();
		});
	}

	private updateItemStatuses(): void {
		if (!this.lastCalculatedTimes) return;

		if (this.lastCalculatedTimes.dateKey !== this.plugin.prayer.getCurrentDateKey()) {
			this.refresh();
			return;
		}

		const now = Date.now();
		const warningMs = this.plugin.settings.warningIntervalMinutes * 60 * 1000;
		const activeThresholdMs = ACTIVE_PRAYER_THRESHOLD_MS;

		let nextItem: PrayerTimeItem | null = null;

		for (const item of this.lastCalculatedTimes.items) {
			const itemEl = this.itemElements.get(item.key);
			if (!itemEl) continue;

			itemEl.removeClass("is-past", "is-approaching", "is-now", "is-upcoming");

			const diff = item.timestamp - now;

			if (diff < -activeThresholdMs) {
				itemEl.addClass("is-past");
			} else if (diff <= 0 && diff >= -activeThresholdMs) {
				itemEl.addClass("is-now");
				if (!nextItem) nextItem = item;
			} else if (diff > 0 && diff <= warningMs) {
				itemEl.addClass("is-approaching");
				if (!nextItem) nextItem = item;
			} else {
				itemEl.addClass("is-upcoming");
				if (!nextItem && diff > 0) nextItem = item;
			}
		}

		if (this.nextValueEl && this.nextLabelEl && this.nextCountdownEl) {
			if (nextItem) {
				this.nextLabelEl.removeClass("hidden");
				this.nextValueEl.removeClass("hidden");
				const isNow = now >= nextItem.timestamp && now - nextItem.timestamp <= activeThresholdMs;
				this.nextLabelEl.setText(`${isNow ? "وقت فعلی" : "وقت بعدی"} · ${nextItem.label}`);
				this.nextValueEl.setText(toPersianDigits(nextItem.time));
				this.nextCountdownEl.setText(isNow ? "اکنون" : formatCountdown(nextItem.timestamp - now));
			} else {
				this.nextLabelEl.addClass("hidden");
				this.nextValueEl.addClass("hidden");
				this.nextCountdownEl.setText("پایان اوقات امروز");
			}
		}
		if (this.headerEl && this.lastCalculatedTimes) {
			const nextTheme = this.getThemePeriod(now, this.lastCalculatedTimes);

			if (this.currentTheme !== nextTheme) {
				if (this.currentTheme) {
					this.headerEl.removeClass(`theme-${this.currentTheme}`);
				}
				this.headerEl.addClass(`theme-${nextTheme}`);
				this.currentTheme = nextTheme;
			}
		}

		if (
			this.lastCelestialUpdateAt === null ||
			now - this.lastCelestialUpdateAt >= CELESTIAL_UPDATE_INTERVAL_MS
		) {
			this.updateCelestialPosition(now, this.lastCalculatedTimes);
			this.lastCelestialUpdateAt = now;
		}
	}

	private updateCelestialPosition(now: number, times: CalculatedPrayerTimes): void {
		if (!this.sky) return;

		const getTs = (key: PrayerKey): number | null =>
			times.allItems.find((i) => i.key === key)?.timestamp ?? null;

		const sunrise = getTs("sunrise");
		const sunset = getTs("sunset");
		if (sunrise === null || sunset === null || sunset <= sunrise) return;

		const dayMs = 24 * 60 * 60 * 1000;
		const isBeforeSunrise = now < sunrise;

		this.sky.update({
			now,
			sunrise,
			sunset,
			prevSunset: isBeforeSunrise ? sunset - dayMs : sunset,
			nextSunrise: isBeforeSunrise ? sunrise : sunrise + dayMs,
			markers: times.allItems
				.filter((item) => item.key !== "sunrise" && item.key !== "sunset")
				.map((item) => ({ key: item.key, label: item.label, timestamp: item.timestamp })),
		});
	}

	private startTimer(): void {
		this.stopTimer();
		this.timerId = window.setInterval(() => this.updateItemStatuses(), VIEW_UPDATE_INTERVAL_MS);
	}

	private stopTimer(): void {
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
	}

	private getThemePeriod(
		now: number,
		times: CalculatedPrayerTimes,
	): "morning" | "day" | "evening" | "night" {
		const getTs = (key: PrayerKey): number =>
			times.allItems.find((i) => i.key === key)?.timestamp ?? 0;

		const fajr = getTs("fajr");
		const dhuhr = getTs("dhuhr");
		const asr = getTs("asr");
		const maghrib = getTs("maghrib");

		if (now < fajr || now >= maghrib) return "night";
		if (now >= fajr && now < dhuhr) return "morning";
		if (now >= dhuhr && now < asr) return "day";

		return "evening";
	}
}
