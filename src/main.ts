import { Plugin } from "obsidian";
import { STATUS_BAR_UPDATE_INTERVAL_MS, VIEW_TYPE_PRAYER_TIMES } from "./core/constants";
import { DEFAULT_SETTINGS, normalizeSettings } from "./core/settings";
import { CityService } from "./services/city-service";
import { PrayerService } from "./services/prayer-service";
import { PrayerChimeSettingTab } from "./settings/settings-tab";
import type { PrayerChimeSettings, PrayerTimeItem } from "./types";
import { PrayerTimesView } from "./views/prayer-times-view";

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

		if (this.settings.showStatusBar) this.initStatusBar();

		this.registerInterval(
			window.setInterval(() => {
				if (this.settings.showStatusBar) void this.updateStatusBar();
			}, STATUS_BAR_UPDATE_INTERVAL_MS),
		);
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.updateViews();
		if (this.settings.showStatusBar) void this.updateStatusBar();
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

		if (leaf) await workspace.revealLeaf(leaf);
	}

	updateViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PRAYER_TIMES)) {
			if (leaf.view instanceof PrayerTimesView) leaf.view.refresh();
		}
	}

	async selectCity(cityId: string): Promise<void> {
		this.settings.selectedCityId = cityId;
		await this.saveSettings();
	}

	initStatusBar(): void {
		if (!this.statusBarEl) this.statusBarEl = this.addStatusBarItem();
		void this.updateStatusBar();
	}

	removeStatusBar(): void {
		this.statusBarEl?.remove();
		this.statusBarEl = null;
	}

	private async updateStatusBar(): Promise<void> {
		if (!this.settings.showStatusBar || !this.statusBarEl) return;

		try {
			const cities = await this.cities.getCities();
			const city =
				cities.find((c) => c.id === this.settings.selectedCityId) ?? this.cities.getTehran(cities);
			const calculated = this.prayer.calculate(city, this.settings);
			const nextPrayer: PrayerTimeItem | undefined = calculated.items.find(
				(item) => item.timestamp > Date.now(),
			);
			this.statusBarEl.setText(
				nextPrayer ? `🕌 بعدی: ${nextPrayer.label} ${nextPrayer.time}` : "🕌 پایان اوقات امروز",
			);
		} catch (error) {
			console.warn("PrayerChime: Failed to update status bar", error);
		}
	}

	private async initDefaultCity(): Promise<void> {
		const cities = await this.cities.getCities();
		const selectedCity = await this.cities.getSelectedCity(
			this.settings.selectedCityId,
			this.settings.selectedprovinceCode,
		);
		if (
			selectedCity.id !== this.settings.selectedCityId ||
			!cities.some((city) => city.id === this.settings.selectedCityId)
		) {
			this.settings.selectedCityId = selectedCity.id;
			await this.saveSettings();
		}
	}

	async toggleFavoriteCity(cityId: string): Promise<void> {
		const index = this.settings.favoriteCityIds.indexOf(cityId);
		if (index > -1) this.settings.favoriteCityIds.splice(index, 1);
		else this.settings.favoriteCityIds.push(cityId);
		await this.saveSettings();
	}
}
