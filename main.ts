import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, setIcon, type IconName } from "obsidian";
import { CityService } from "./city-service";
import { PrayerService } from "./prayer-service";
import type {CalculatedPrayerTimes, PrayerChimeSettings, PrayerKey, PrayerTimeItem} from "./types";

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
};

const LEGACY_KEYS: Partial<Record<string, PrayerKey>> = {
	Imsaak: "fajr",
	Sunrise: "sunrise",
	Noon: "dhuhr",
	Sunset: "sunset",
	Maghreb: "maghrib",
	Midnight: "midnight",
};

export default class PrayerChimePlugin extends Plugin {
	settings: PrayerChimeSettings = structuredClone(DEFAULT_SETTINGS);
	readonly prayerService = new PrayerService();
	private cityService: CityService | null = null;
	private midnightTimeout: number | null = null;

	async onload(): Promise<void> {
		this.cityService = new CityService(this.app.vault, this.manifest);
		await this.loadSettings();
		await this.ensureSelectedCity();
		this.registerView(VIEW_TYPE_PRAYER_TIMES, (leaf) => new PrayerTimesView(leaf, this));
		this.addSettingTab(new PrayerChimeSettingsTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
		this.scheduleMidnightRefresh();
	}

	onunload(): void {
		if (this.midnightTimeout !== null) {
			window.clearTimeout(this.midnightTimeout);
			this.midnightTimeout = null;
		}
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_PRAYER_TIMES);
	}

	get cities(): CityService {
		if (!this.cityService) {
			this.cityService = new CityService(this.app.vault, this.manifest);
		}
		return this.cityService;
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<PrayerChimeSettings> | null;
		this.settings = this.normalizeSettings(saved ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.refreshViews();
	}

	async calculatePrayerTimes(): Promise<CalculatedPrayerTimes> {
		const city = await this.ensureSelectedCity();
		return this.prayerService.calculate(city, this.settings);
	}

	async selectCity(cityId: string): Promise<void> {
		const city = (await this.cities.getCities()).find((item) => item.id === cityId);
		if (!city) {
			return;
		}
		this.settings.selectedCityId = city.id;
		this.settings.selectedCity = city.city;
		await this.saveSettings();
		new Notice(`شهر ${city.city} انتخاب شد.`);
	}

	private normalizeSettings(saved: Partial<PrayerChimeSettings>): PrayerChimeSettings {
		const settings = structuredClone(DEFAULT_SETTINGS);
		settings.selectedCityId = typeof saved.selectedCityId === "string" ? saved.selectedCityId : "";
		settings.selectedCity = typeof saved.selectedCity === "string" ? saved.selectedCity : undefined;
		settings.selectedprovinceCode = typeof saved.selectedprovinceCode === "string" ? saved.selectedprovinceCode : undefined;
		const savedTimes = saved.displayedTimes as Partial<PrayerChimeSettings["displayedTimes"]> | Record<string, unknown> | undefined;
		if (savedTimes && typeof savedTimes === "object") {
			for (const [key, value] of Object.entries(savedTimes)) {
				const normalizedKey = (LEGACY_KEYS[key] ?? key) as PrayerKey;
				if (normalizedKey in settings.displayedTimes && value && typeof value === "object") {
					const display = (value as { display?: unknown; text?: unknown }).display;
					const text = (value as { display?: unknown; text?: unknown }).text;
					settings.displayedTimes[normalizedKey] = { display: typeof display === "boolean" ? display : settings.displayedTimes[normalizedKey].display, text: typeof text === "string" && text.length > 0 ? text : settings.displayedTimes[normalizedKey].text };
				}
			}
		}
		return settings;
	}

	private async ensureSelectedCity() {
		const city = await this.cities.getSelectedCity(this.settings.selectedCityId, this.settings.selectedprovinceCode);
		if (city.id !== this.settings.selectedCityId) {
			this.settings.selectedCityId = city.id;
			this.settings.selectedCity = city.city;
			await this.saveData(this.settings);
		}
		return city;
	}

	private async activateView(): Promise<void> {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_PRAYER_TIMES).length === 0) {
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_PRAYER_TIMES, active: false });
			}
		}
	}

	private async refreshViews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PRAYER_TIMES)) {
			const view = leaf.view;
			if (view instanceof PrayerTimesView) {
				await view.render();
			}
		}
	}

	private scheduleMidnightRefresh(): void {
		if (this.midnightTimeout !== null) {
			window.clearTimeout(this.midnightTimeout);
		}
		this.midnightTimeout = window.setTimeout(() => {
			this.midnightTimeout = null;
			void this.refreshViews();
			this.scheduleMidnightRefresh();
		}, this.prayerService.millisecondsUntilNextTehranMidnight());
	}
}

class PrayerTimesView extends ItemView {
	private headingEl: HTMLHeadingElement | null = null;
	private listEl: HTMLDivElement | null = null;
	private statusEl: HTMLDivElement | null = null;
	private updateTimer: number | null = null;
	private currentItems: PrayerTimeItem[] = [];

	constructor(leaf: WorkspaceLeaf, private readonly plugin: PrayerChimePlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PRAYER_TIMES;
	}

	getIcon(): IconName {
		return "moon";
	}

	getDisplayText(): string {
		return "PrayerChime";
	}

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		const content = container.createDiv();
		content.addClass("prayer-chime-view");

		this.headingEl = content.createEl("h3", { cls: "text_center" });
		this.statusEl = content.createDiv({ cls: "prayer-chime-status" });
		this.listEl = content.createDiv({ cls: "prayer_times_list" });

		const button = content.createEl("button", {
			text: "بازنشانی ↻",
			cls: "update-province-button"
		});

		this.registerDomEvent(button, "click", () => {
			void this.render();
		});

		this.updateTimer = window.setInterval(() => this.updateItemStatuses(), 30000);

		await this.render();
	}

	async onClose(): Promise<void> {
		if (this.updateTimer !== null) {
			window.clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
	}

	async render(): Promise<void> {
		if (!this.headingEl || !this.listEl || !this.statusEl) {
			return;
		}
		try {
			const result = await this.plugin.calculatePrayerTimes();
			this.headingEl.setText(`اوقات شرعی ${result.city.city}`);
			this.statusEl.setText("");
			this.listEl.empty();
			this.currentItems = result.items;
			for (const item of result.items) {
				const itemEl = this.listEl.createDiv({ cls: "prayer_item", attr: { "data-key": item.key } });
				const titleWrapper = itemEl.createDiv({ cls: "prayer_title_wrapper" });
				const iconEl = titleWrapper.createSpan({ cls: "prayer_icon" });
				setIcon(iconEl, PRAYER_ICONS[item.key]);
				titleWrapper.createEl("span", { text: item.label, cls: "prayer_title" });
				itemEl.createEl("p", { text: item.time, cls: "prayer_value" });
			}
			this.updateItemStatuses();
		} catch (error) {
			this.headingEl.setText("اوقات شرعی");
			this.statusEl.setText("اوقات شرعی یافت نشد.");
			this.listEl.empty();
		}
	}

	private updateItemStatuses(): void {
		if (!this.listEl) return;
		const now = Date.now();
		const children = this.listEl.children;
		for (let i = 0; i < children.length; i++) {
			const el = children[i] as HTMLElement;
			const key = el.getAttribute("data-key");
			const item = this.currentItems.find(x => x.key === key);
			if (!item) continue;

			const diffMins = (item.timestamp - now) / 60000;
			el.removeClass("past", "now", "approaching");

			if (diffMins > 0 && diffMins <= 10) {
				// 10 minutes before prayer time
				el.addClass("approaching");
			} else if (diffMins <= 0 && diffMins >= -5) {
				// Prayer time reached (up to 5 mins after)
				el.addClass("now");
			} else if (diffMins < -5) {
				// Prayer time passed
				el.addClass("past");
			}
		}
	}
}

class PrayerChimeSettingsTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: PrayerChimePlugin) {
		super(app, plugin);
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		for (const [key, value] of Object.entries(DEFAULT_SETTINGS.displayedTimes) as [PrayerKey, typeof DEFAULT_SETTINGS.displayedTimes[PrayerKey]][]) {
			new Setting(containerEl).setName(`نمایش ${value.text}`).setClass("setting_toggle").addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.displayedTimes[key]?.display ?? false);
				toggle.onChange(async (enabled) => {
					this.plugin.settings.displayedTimes[key].display = enabled;
					await this.plugin.saveSettings();
				});
			});
		}
		containerEl.createEl("hr");
		containerEl.createEl("h3", { text: "انتخاب شهر", cls: "text_center" });
		const searchBox = containerEl.createEl("input", { type: "text", placeholder: "شهر مورد نظر را جستجو کنید...", cls: "search-box" });
		const cityContainer = containerEl.createDiv({ cls: "province-container" });
		const cityList = cityContainer.createEl("ul", { cls: "province-list" });
		const cities = await this.plugin.cities.getCities();
		cityList.addEventListener("click", (event) => {
			const target = event.target instanceof HTMLElement ? event.target.closest("li[data-city-id]") : null;
			const cityId = target instanceof HTMLElement ? target.dataset.cityId : undefined;
			if (cityId) {
				void this.plugin.selectCity(cityId).then(() => renderCities(searchBox.value.trim()));
			}
		});
		let frame = 0;
		const renderCities = (filter: string): void => {
			if (frame) {
				window.cancelAnimationFrame(frame);
			}
			frame = window.requestAnimationFrame(() => {
				cityList.empty();
				const fragment = document.createDocumentFragment();
				const filtered = this.plugin.cities.search(cities, filter, SEARCH_LIMIT);
				for (const city of filtered) {
					const item = document.createElement("li");
					item.textContent = city.province === city.city ? city.city : `${city.city}، ${city.province}`;
					item.dataset.cityId = city.id;
					if (city.id === this.plugin.settings.selectedCityId) {
						item.addClass("selected");
					}
					fragment.appendChild(item);
				}
				if (filtered.length === 0) {
					const empty = document.createElement("li");
					empty.textContent = "هیچ شهری یافت نشد.";
					empty.addClass("no-results");
					fragment.appendChild(empty);
				}
				cityList.appendChild(fragment);
			});
		};
		searchBox.addEventListener("input", () => renderCities(searchBox.value.trim()));
		renderCities("");
	}
}
