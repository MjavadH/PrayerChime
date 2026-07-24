import {
	App,
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	setIcon,
	type IconName,
} from "obsidian";
import { CityService } from "./city-service";
import { PrayerService } from "./prayer-service";
import type {
	CalculatedPrayerTimes,
	City,
	PrayerChimeSettings,
	PrayerKey,
	PrayerTimeItem,
} from "./types";

const VIEW_TYPE_PRAYER_TIMES = "prayer-times-view";
const SEARCH_LIMIT = 80;

const PRAYER_ICONS: Record<PrayerKey, IconName> = {
	fajr: "sunrise",
	sunrise: "sunrise",
	dhuhr: "sun",
	asr: "sun-dim",
	sunset: "sunset",
	maghrib: "moon-star",
	isha: "moon",
	midnight: "sparkles",
};

const DEFAULT_SETTINGS: PrayerChimeSettings = {
	selectedCityId: "",
	displayedTimes: {
		fajr: { display: true, text: "اذان صبح" },
		sunrise: { display: true, text: "طلوع آفتاب" },
		dhuhr: { display: true, text: "اذان ظهر" },
		asr: { display: true, text: "اذان عصر" },
		sunset: { display: true, text: "غروب آفتاب" },
		maghrib: { display: true, text: "اذان مغرب" },
		isha: { display: true, text: "اذان عشاء" },
		midnight: { display: true, text: "نیمه‌شب شرعی" },
	},
	warningIntervalMinutes: 10,
	showStatusBar: true,
	calculationMethod: "Tehran",
	favoriteCityIds: [],
};

export default class PrayerChimePlugin extends Plugin {
	settings: PrayerChimeSettings = DEFAULT_SETTINGS;
	readonly cities = new CityService();
	readonly prayer = new PrayerService();

	private statusBarEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_PRAYER_TIMES, (leaf) => new PrayerTimesView(leaf, this));

		this.addRibbonIcon("sparkles", "PrayerChime", () => {
			void this.activateView();
		});

		this.addSettingTab(new PrayerChimeSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.initDefaultCity();
		});

		if (this.settings.showStatusBar) {
			this.initStatusBar();
		}

		this.registerInterval(
			window.setInterval(() => {
				if (this.settings.showStatusBar) {
					void this.updateStatusBar();
				}
			}, 60000),
		);
	}

	async loadSettings(): Promise<void> {
		const loadedData = (await this.loadData()) as Partial<PrayerChimeSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.updateViews();
		if (this.settings.showStatusBar) {
			void this.updateStatusBar();
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_PRAYER_TIMES)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE_PRAYER_TIMES, active: true });
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}

	updateViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PRAYER_TIMES);
		for (const leaf of leaves) {
			if (leaf.view instanceof PrayerTimesView) {
				leaf.view.refresh();
			}
		}
	}

	async selectCity(cityId: string): Promise<void> {
		this.settings.selectedCityId = cityId;
		await this.saveSettings();
	}

	initStatusBar(): void {
		if (!this.statusBarEl) {
			this.statusBarEl = this.addStatusBarItem();
		}
		void this.updateStatusBar();
	}

	removeStatusBar(): void {
		if (this.statusBarEl) {
			this.statusBarEl.remove();
			this.statusBarEl = null;
		}
	}

	private async updateStatusBar(): Promise<void> {
		if (!this.settings.showStatusBar || !this.statusBarEl) return;

		try {
			const cities = await this.cities.getCities();
			const city =
				cities.find((c) => c.id === this.settings.selectedCityId) ??
				this.cities.getTehran(cities);
			const calculated = this.prayer.calculate(city, this.settings);
			const now = Date.now();

			let nextPrayer: PrayerTimeItem | undefined;
			for (const item of calculated.items) {
				if (item.timestamp > now) {
					nextPrayer = item;
					break;
				}
			}

			if (nextPrayer) {
				this.statusBarEl.setText(`🕌 بعدی: ${nextPrayer.label} ${nextPrayer.time}`);
			} else {
				this.statusBarEl.setText(`🕌 پایان اوقات امروز`);
			}
		} catch (error) {
			console.error("PrayerChime: Failed to update status bar", error);
		}
	}

	private async initDefaultCity(): Promise<void> {
		const cities = await this.cities.getCities();

		if (
			!this.settings.selectedCityId ||
			!cities.some((city) => city.id === this.settings.selectedCityId)
		) {
			const defaultCity = this.cities.getTehran(cities);
			this.settings.selectedCityId = defaultCity.id;
			await this.saveSettings();
		}
	}

	async toggleFavoriteCity(cityId: string): Promise<void> {
		const index = this.settings.favoriteCityIds.indexOf(cityId);
		if (index > -1) {
			this.settings.favoriteCityIds.splice(index, 1);
		} else {
			this.settings.favoriteCityIds.push(cityId);
		}
		await this.saveSettings();
	}
}

/* VIEW */
class PrayerTimesView extends ItemView {
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
		this.startTimer();
	}

	async onClose(): Promise<void> {
		this.stopTimer();
	}

	refresh(): void {
		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement | undefined;
		if (!container) return;

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
				window.setTimeout(() => refreshBtn.removeClass("is-spinning"), 600);
			});

			header.createDiv({
				cls: "pc-header__date",
				text: this.formatTodayPersian(),
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

					itemEl.createSpan({ cls: "pc-item__time", text: this.toPersianDigits(item.time) });
				}
			}

			this.updateItemStatuses();
		});
	}

	private updateItemStatuses(): void {
		if (!this.lastCalculatedTimes) return;

		const now = Date.now();
		const warningMs = (this.plugin.settings.warningIntervalMinutes ?? 10) * 60 * 1000;
		const activeThresholdMs = 2 * 60 * 1000;

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
				this.nextValueEl.setText(this.toPersianDigits(nextItem.time));
				this.nextCountdownEl.setText(this.formatCountdown(nextItem.timestamp - now));
			} else {
				this.nextLabelEl.setText("وقت بعدی");
				this.nextValueEl.setText("—");
				this.nextCountdownEl.setText("پایان اوقات امروز");
			}
		}
	}

	private toPersianDigits(input: string): string {
		const map: Record<string, string> = {
			"0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
			"5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹",
		};
		return input.replace(/[0-9]/g, (d) => map[d] ?? d);
	}

	private formatCountdown(ms: number): string {
		if (ms <= 0) return "اکنون";
		const totalMinutes = Math.max(1, Math.round(ms / 60000));
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		let text: string;
		if (hours > 0 && minutes > 0) {
			text = `${hours} ساعت و ${minutes} دقیقه مانده`;
		} else if (hours > 0) {
			text = `${hours} ساعت مانده`;
		} else {
			text = `${minutes} دقیقه مانده`;
		}
		return this.toPersianDigits(text);
	}

	private formatTodayPersian(): string {
		try {
			const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
				weekday: "long",
				day: "numeric",
				month: "long",
			});
			const parts = formatter.formatToParts(new Date()) as { type: string; value: string }[];

			const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
			const day = parts.find((p) => p.type === "day")?.value ?? "";
			const month = parts.find((p) => p.type === "month")?.value ?? "";

			if (!weekday && !day && !month) return "";
			return `${weekday} ${day} ${month}`.trim();
		} catch {
			return "";
		}
	}

	private startTimer(): void {
		this.stopTimer();
		this.timerId = window.setInterval(() => this.updateItemStatuses(), 10000);
	}

	private stopTimer(): void {
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
	}
}

/* SETTINGS TAB */
class PrayerChimeSettingTab extends PluginSettingTab {
	private readonly plugin: PrayerChimePlugin;

	constructor(app: App, plugin: PrayerChimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("prayer-chime-settings");

		/* Intro card */
		const intro = containerEl.createDiv({ cls: "pc-settings-header" });
		new Setting(intro)
			.setName("تنظیمات PrayerChime")
			.setDesc("روش محاسبه، اوقات نمایشی و شهر مورد نظر خود را انتخاب کنید. تغییرات به‌صورت خودکار ذخیره می‌شوند.")
			.setHeading();

		/* General */
		this.renderSectionHeader(containerEl, "settings", "تنظیمات عمومی");

		new Setting(containerEl)
			.setName("روش محاسبه")
			.setDesc("الگوریتم و زوایای محاسبه اوقات شرعی را انتخاب کنید.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("Tehran", "موسسه ژئوفیزیک دانشگاه تهران (پیش‌فرض)")
					.addOption("Jafari", "شیعه اثنی‌عشری (موسسه لوا)")
					.addOption("ISNA", "انجمن اسلامی آمریکای شمالی (ISNA)")
					.addOption("MWL", "رابطه العالم الاسلامی (MWL)")
					.addOption("UmmAlQura", "دانشگاه ام‌القری (مکه)")
					.setValue(this.plugin.settings.calculationMethod)
					.onChange(
						async (
							value: "Tehran" | "Jafari" | "ISNA" | "MWL" | "UmmAlQura",
						) => {
							this.plugin.settings.calculationMethod = value;
							await this.plugin.saveSettings();
						},
					);
			});

		new Setting(containerEl)
			.setName("نمایش در نوار وضعیت")
			.setDesc("نمایش زمان اذان بعدی در نوار پایین صفحه.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showStatusBar = value;
						await this.plugin.saveSettings();

						if (value) {
							this.plugin.initStatusBar();
						} else {
							this.plugin.removeStatusBar();
						}
					});
			});

		new Setting(containerEl)
			.setName("بازه زمانی هشدار")
			.setDesc("چند دقیقه پیش از اذان وضعیت به «در حال نزدیک شدن» تغییر کند.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("5", "۵ دقیقه")
					.addOption("10", "۱۰ دقیقه (پیش‌فرض)")
					.addOption("15", "۱۵ دقیقه")
					.addOption("30", "۳۰ دقیقه")
					.setValue(String(this.plugin.settings.warningIntervalMinutes ?? 10))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						this.plugin.settings.warningIntervalMinutes = isNaN(parsed)
							? 10
							: parsed;
						await this.plugin.saveSettings();
					});
			});

		/* Displayed times */
		this.renderSectionHeader(containerEl, "list-checks", "نمایش اوقات شرعی");

		for (const key of Object.keys(DEFAULT_SETTINGS.displayedTimes) as PrayerKey[]) {
			const itemSetting = this.plugin.settings.displayedTimes[key];
			if (!itemSetting) continue;

			new Setting(containerEl).setName(itemSetting.text).addToggle((toggle) => {
				toggle.setValue(itemSetting.display).onChange(async (value) => {
					itemSetting.display = value;
					await this.plugin.saveSettings();
				});
			});
		}

		/* City picker */
		this.renderSectionHeader(containerEl, "map-pin", "انتخاب شهر");

		const picker = containerEl.createDiv({ cls: "pc-city-picker" });

		const favoritesContainer = picker.createDiv({ cls: "pc-favorites is-empty" });

		const searchWrap = picker.createDiv({ cls: "pc-search" });
		const searchIcon = searchWrap.createSpan({ cls: "pc-search__icon" });
		setIcon(searchIcon, "search");
		const searchBox = searchWrap.createEl("input", {
			type: "text",
			attr: { placeholder: "جستجوی شهر یا استان...", spellcheck: "false" },
		});

		const cityContainer = picker.createDiv({ cls: "pc-city-list-wrap" });
		const cityList = cityContainer.createEl("ul", { cls: "pc-city-list" });

		void this.plugin.cities.getCities().then((cities) => {
			const cityMap = new Map<string, City>(cities.map((c) => [c.id, c]));

			const renderFavorites = (): void => {
				favoritesContainer.empty();
				const favorites = this.plugin.settings.favoriteCityIds
					.map((id) => cityMap.get(id))
					.filter((c): c is City => c !== undefined);

				if (favorites.length === 0) {
					favoritesContainer.addClass("is-empty");
					return;
				}
				favoritesContainer.removeClass("is-empty");

				for (const city of favorites) {
					const isSelected = city.id === this.plugin.settings.selectedCityId;
					const chip = favoritesContainer.createDiv({
						cls: `pc-chip${isSelected ? " is-selected" : ""}`,
					});

					const label = chip.createSpan({
						text:
							city.province === city.city
								? city.city
								: `${city.city} (${city.province})`,
					});

					label.addEventListener("click", () => {
						void this.plugin.selectCity(city.id).then(() => {
							renderFavorites();
							renderCities(searchBox.value.trim());
						});
					});

					const removeBtn = chip.createDiv({ cls: "pc-chip__remove" });
					setIcon(removeBtn, "x");
					removeBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						void this.plugin.toggleFavoriteCity(city.id).then(() => {
							renderFavorites();
							renderCities(searchBox.value.trim());
						});
					});
				}
			};

			cityList.addEventListener("click", (event: MouseEvent) => {
				const target = event.target as HTMLElement | null;
				const starBtn = target?.closest<HTMLElement>(".pc-star");
				const listItem = target?.closest<HTMLLIElement>("li[data-city-id]");
				const cityId = listItem?.getAttribute("data-city-id");

				if (!cityId) return;

				if (starBtn) {
					event.stopPropagation();
					void this.plugin.toggleFavoriteCity(cityId).then(() => {
						renderFavorites();
						renderCities(searchBox.value.trim());
					});
				} else {
					void this.plugin.selectCity(cityId).then(() => {
						renderFavorites();
						renderCities(searchBox.value.trim());
					});
				}
			});

			let frame = 0;
			const renderCities = (filter: string): void => {
				if (frame) {
					window.cancelAnimationFrame(frame);
				}
				frame = window.requestAnimationFrame(() => {
					cityList.empty();
					const filtered = this.plugin.cities.search(cities, filter, SEARCH_LIMIT);
					const favoriteSet = new Set(this.plugin.settings.favoriteCityIds);

					if (filtered.length === 0) {
						cityList.createEl("li", {
							cls: "pc-no-results",
							text: "نتیجه‌ای یافت نشد.",
						});
						return;
					}

					for (const city of filtered) {
						const isSelected = city.id === this.plugin.settings.selectedCityId;
						const isFav = favoriteSet.has(city.id);

						const item = cityList.createEl("li", {
							attr: { "data-city-id": city.id },
							cls: isSelected ? "is-selected" : "",
						});

						item.createSpan({
							text:
								city.province === city.city
									? city.city
									: `${city.city}، ${city.province}`,
						});

						const starBtn = item.createDiv({
							cls: `pc-star${isFav ? " is-active" : ""}`,
							attr: {
								"aria-label": isFav
									? "حذف از علاقمندی‌ها"
									: "افزودن به علاقمندی‌ها",
								role: "button",
							},
						});
						setIcon(starBtn, "star");
					}
				});
			};

			searchBox.addEventListener("input", () => {
				renderCities(searchBox.value.trim());
			});

			renderFavorites();
			renderCities("");
		});
	}

	private renderSectionHeader(
		parent: HTMLElement,
		icon: IconName,
		title: string,
	): void {
		const setting = new Setting(parent).setName(title).setHeading();
		setting.settingEl.addClass("pc-section");

		const iconEl = setting.settingEl.createSpan({ cls: "pc-section__icon" });
		setIcon(iconEl, icon);
		setting.settingEl.prepend(iconEl);
	}
}
