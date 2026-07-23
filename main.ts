import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, setIcon, type IconName } from "obsidian";
import { CityService } from "./city-service";
import { PrayerService } from "./prayer-service";
import type { CalculatedPrayerTimes, PrayerChimeSettings, PrayerKey, PrayerTimeItem } from "./types";

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
};

export default class PrayerChimePlugin extends Plugin {
	settings: PrayerChimeSettings = DEFAULT_SETTINGS;
	readonly cities = new CityService();
	readonly prayer = new PrayerService();

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
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.updateViews();
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
			workspace.revealLeaf(leaf);
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

	private async initDefaultCity(): Promise<void> {
		const cities = await this.cities.getCities();

		if (!this.settings.selectedCityId || !cities.some((city) => city.id === this.settings.selectedCityId)) {
			const defaultCity = this.cities.getTehran(cities);
			this.settings.selectedCityId = defaultCity.id;
			await this.saveSettings();
		}
	}
}

class PrayerTimesView extends ItemView {
	private readonly plugin: PrayerChimePlugin;
	private timerId: number | null = null;
	private lastCalculatedTimes: CalculatedPrayerTimes | null = null;
	private itemElements: Map<PrayerKey, HTMLElement> = new Map();

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
		const container = this.containerEl.children[1];
		if (!container) return;

		container.empty();
		container.addClass("prayer-chime-view");

		void this.plugin.cities.getCities().then((cities) => {
			const city = cities.find((c) => c.id === this.plugin.settings.selectedCityId) ?? this.plugin.cities.getTehran(cities);
			const calculated = this.plugin.prayer.calculate(city, this.plugin.settings);
			this.lastCalculatedTimes = calculated;

			const titleEl = container.createEl("h3", {
				text: `اوقات شرعی ${city.city}`,
				cls: "text_center",
			});

			const listEl = container.createDiv({ cls: "prayer_times_list" });
			this.itemElements.clear();

			for (const item of calculated.items) {
				const itemEl = listEl.createDiv({ cls: "prayer_item" });
				this.itemElements.set(item.key, itemEl);

				const labelGroup = itemEl.createDiv({ cls: "prayer_label_group" });
				const iconEl = labelGroup.createSpan({ cls: "prayer_icon" });
				setIcon(iconEl, PRAYER_ICONS[item.key]);

				labelGroup.createSpan({ text: item.label, cls: "prayer_name" });
				itemEl.createSpan({ text: item.time, cls: "prayer_time" });
			}

			this.updateItemStatuses();
		});
	}

	private updateItemStatuses(): void {
		if (!this.lastCalculatedTimes) return;

		const now = Date.now();
		// Convert setting minutes to milliseconds dynamically
		const warningMs = (this.plugin.settings.warningIntervalMinutes ?? 10) * 60 * 1000;
		const activeThresholdMs = 2 * 60 * 1000;

		for (const item of this.lastCalculatedTimes.items) {
			const itemEl = this.itemElements.get(item.key);
			if (!itemEl) continue;

			itemEl.removeClass("past", "approaching", "now", "upcoming");

			const diff = item.timestamp - now;

			if (diff < -activeThresholdMs) {
				itemEl.addClass("past");
			} else if (diff >= -activeThresholdMs && diff <= activeThresholdMs) {
				itemEl.addClass("now");
			} else if (diff > activeThresholdMs && diff <= warningMs) {
				itemEl.addClass("approaching");
			} else {
				itemEl.addClass("upcoming");
			}
		}
	}

	private startTimer(): void {
		this.stopTimer();
		// Update status classes every 10 seconds
		this.timerId = window.setInterval(() => this.updateItemStatuses(), 10000);
	}

	private stopTimer(): void {
		if (this.timerId !== null) {
			window.clearInterval(this.timerId);
			this.timerId = null;
		}
	}
}

class PrayerChimeSettingTab extends PluginSettingTab {
	private readonly plugin: PrayerChimePlugin;

	constructor(app: App, plugin: PrayerChimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "تنظیمات PrayerChime" });

		// Warning interval setting dropdown
		new Setting(containerEl)
			.setName("بازه زمانی هشدار")
			.setDesc("مدت زمان پیش از اذان برای تغییر وضعیت به 'در حال نزدیک شدن'")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("5", "۵ دقیقه")
					.addOption("10", "۱۰ دقیقه (پیش‌فرض)")
					.addOption("15", "۱۵ دقیقه")
					.addOption("30", "۳۰ دقیقه")
					.setValue(String(this.plugin.settings.warningIntervalMinutes ?? 10))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						this.plugin.settings.warningIntervalMinutes = isNaN(parsed) ? 10 : parsed;
						await this.plugin.saveSettings();
					});
			});

		// Displayed items toggle list
		containerEl.createEl("h3", { text: "نمایش اوقات شرعی" });

		for (const key of Object.keys(DEFAULT_SETTINGS.displayedTimes) as PrayerKey[]) {
			const itemSetting = this.plugin.settings.displayedTimes[key];
			if (!itemSetting) continue;

			new Setting(containerEl)
				.setName(itemSetting.text)
				.addToggle((toggle) => {
					toggle.setValue(itemSetting.display).onChange(async (value) => {
						itemSetting.display = value;
						await this.plugin.saveSettings();
					});
				});
		}

		// City selector section
		containerEl.createEl("h3", { text: "انتخاب شهر" });

		const searchBox = containerEl.createEl("input", { type: "text", placeholder: "جستجوی شهر یا استان...", cls: "search-box" });
		const cityContainer = containerEl.createDiv({ cls: "province-container" });
		const cityList = cityContainer.createEl("ul", { cls: "province-list" });

		void this.plugin.cities.getCities().then((cities) => {
			cityList.addEventListener("click", (event: MouseEvent) => {
				const target = event.target as HTMLElement | null;
				const listItem = target?.closest<HTMLLIElement>("li[data-city-id]");
				const cityId = listItem?.getAttribute("data-city-id");
				if (cityId) {
					void this.plugin.selectCity(cityId).then(() => {
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
					for (const city of filtered) {
						const item = cityList.createEl("li", {
							text: city.province === city.city ? city.city : `${city.city}، ${city.province}`,
							attr: { "data-city-id": city.id },
						});
						if (city.id === this.plugin.settings.selectedCityId) {
							item.addClass("selected");
						}
					}
				});
			};

			searchBox.addEventListener("input", () => {
				renderCities(searchBox.value.trim());
			});

			renderCities("");
		});
	}
}
