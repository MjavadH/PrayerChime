import type {App, IconName, SettingDefinition} from "obsidian";
import { PluginSettingTab, Setting, setIcon } from "obsidian";
import { PRAYER_ORDER, SEARCH_LIMIT } from "../core/constants";
import { isCalculationMethod } from "../core/settings";
import type PrayerChimePlugin from "../main";
import type { City } from "../types";

export class PrayerChimeSettingTab extends PluginSettingTab {
	private readonly plugin: PrayerChimePlugin;

	constructor(app: App, plugin: PrayerChimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinition[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("prayer-chime-settings");

		/* Intro card */
		const intro = containerEl.createDiv({ cls: "pc-settings-header" });
		new Setting(intro)
			.setName("تنظیمات")
			.setDesc(
				"روش محاسبه، اوقات نمایشی و شهر مورد نظر خود را انتخاب کنید. تغییرات به‌صورت خودکار ذخیره می‌شوند.",
			)
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
					.onChange(async (value) => {
						if (!isCalculationMethod(value)) return;
						this.plugin.settings.calculationMethod = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("نمایش در نوار وضعیت")
			.setDesc("نمایش زمان اذان بعدی در نوار پایین صفحه.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
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
						this.plugin.settings.warningIntervalMinutes = Number.isNaN(parsed) ? 10 : parsed;
						await this.plugin.saveSettings();
					});
			});

		/* Displayed times */
		this.renderSectionHeader(containerEl, "list-checks", "نمایش اوقات شرعی");

		for (const key of PRAYER_ORDER) {
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
						text: city.province === city.city ? city.city : `${city.city} (${city.province})`,
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
				const target = event.target;
				if (!(target instanceof Node)) return;

				const starBtn = target.instanceOf(HTMLElement)
					? target.closest<HTMLElement>(".pc-star")
					: null;
				const listItem = target.instanceOf(HTMLElement)
					? target.closest<HTMLLIElement>("li[data-city-id]")
					: null;
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
							text: city.province === city.city ? city.city : `${city.city}، ${city.province}`,
						});

						const starBtn = item.createDiv({
							cls: `pc-star${isFav ? " is-active" : ""}`,
							attr: {
								"aria-label": isFav ? "حذف از علاقمندی‌ها" : "افزودن به علاقمندی‌ها",
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

	private renderSectionHeader(parent: HTMLElement, icon: IconName, title: string): void {
		const setting = new Setting(parent).setName(title);
		setting.settingEl.addClass("pc-section");

		const iconEl = setting.settingEl.createSpan({ cls: "pc-section__icon" });
		setIcon(iconEl, icon);
		setting.settingEl.prepend(iconEl);
	}
}
