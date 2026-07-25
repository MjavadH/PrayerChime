import type { IconName, WorkspaceLeaf } from "obsidian";
import { ItemView, setIcon } from "obsidian";
import {
	ACTIVE_PRAYER_THRESHOLD_MS,
	PRAYER_ICONS,
	REFRESH_SPIN_DURATION_MS,
	VIEW_TYPE_PRAYER_TIMES,
	VIEW_UPDATE_INTERVAL_MS,
} from "../core/constants";
import type PrayerChimePlugin from "../main";
import type { CalculatedPrayerTimes, PrayerKey, PrayerTimeItem } from "../types";
import { formatCountdown, formatTodayPersian, toPersianDigits } from "../utils/format";

export class PrayerTimesView extends ItemView {
	private readonly plugin: PrayerChimePlugin;
	private timerId: number | null = null;
	private lastCalculatedTimes: CalculatedPrayerTimes | null = null;
	private itemElements: Map<PrayerKey, HTMLElement> = new Map();
	private nextValueEl: HTMLElement | null = null;
	private nextLabelEl: HTMLElement | null = null;
	private nextCountdownEl: HTMLElement | null = null;

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

			/* Header */
			const header = container.createDiv({ cls: "pc-header" });

			const topRow = header.createDiv({ cls: "pc-header__top" });
			const titleWrap = topRow.createDiv({ cls: "pc-header__title-wrap" });
			titleWrap.createDiv({ cls: "pc-header__eyebrow", text: "اوقات شرعی" });
			titleWrap.createEl("h3", {
				cls: "pc-header__title",
				text: city.city,
			});

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

			header.createDiv({
				cls: "pc-header__date",
				text: formatTodayPersian(),
			});

			const nextWrap = header.createDiv({ cls: "pc-header__next" });
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

					itemEl.createSpan({ cls: "pc-item__time", text: toPersianDigits(item.time) });
				}
			}

			this.updateItemStatuses();
		});
	}

	private updateItemStatuses(): void {
		if (!this.lastCalculatedTimes) return;

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
			} else if (diff >= -activeThresholdMs && diff <= activeThresholdMs) {
				itemEl.addClass("is-now");
				if (!nextItem) nextItem = item;
			} else if (diff > activeThresholdMs && diff <= warningMs) {
				itemEl.addClass("is-approaching");
				if (!nextItem) nextItem = item;
			} else {
				itemEl.addClass("is-upcoming");
				if (!nextItem && diff > 0) nextItem = item;
			}
		}

		if (this.nextValueEl && this.nextLabelEl && this.nextCountdownEl) {
			if (nextItem) {
				this.nextLabelEl.setText(`وقت بعدی · ${nextItem.label}`);
				this.nextValueEl.setText(toPersianDigits(nextItem.time));
				this.nextCountdownEl.setText(formatCountdown(nextItem.timestamp - now));
			} else {
				this.nextLabelEl.setText("وقت بعدی");
				this.nextValueEl.setText("—");
				this.nextCountdownEl.setText("پایان اوقات امروز");
			}
		}
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
}
