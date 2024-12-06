import { Plugin, ItemView, WorkspaceLeaf, Notice, PluginSettingTab, Setting, App, IconName } from 'obsidian';

interface province {
  name: string;
  code: string;
}
interface PrayerTime {
  display: boolean;
  text: string;
}

interface PrayerTimesPluginSettings {
  selectedprovinceCode: string;
  displayedTimes: Record<string, PrayerTime>;
}

const DEFAULT_SETTINGS: PrayerTimesPluginSettings = {
  selectedprovinceCode: "1", // پیش‌فرض: تهران
  displayedTimes: {
    Imsaak: {display: true, text: "اذان صبح"},
    Sunrise: {display: false, text: "طلوع خورشید"},
    Noon: {display: false, text: "غروب آفتاب"},
    Sunset: {display: true, text: "اذان ظهر"},
    Maghreb: {display: true, text: "اذان مغرب"},
    Midnight: {display: false, text: "نیمه شب شرعی"},
  },
};

const VIEW_TYPE_PRAYER_TIMES = "prayer-times-view";

export default class PrayerTimesPlugin extends Plugin {
  settings: PrayerTimesPluginSettings;

  async onload() {
    await this.loadSettings();

    // ثبت View جدید
    this.registerView(
      VIEW_TYPE_PRAYER_TIMES,
      (leaf) => new PrayerTimesView(leaf, this)
    );

    const rightLeaf = this.app.workspace.getRightLeaf(false);
    await rightLeaf.setViewState({
      type: VIEW_TYPE_PRAYER_TIMES,
      active: true,
    });
    this.app.workspace.revealLeaf(rightLeaf);

    this.addSettingTab(new PrayerTimesSettingsTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  async loadDefaultProvinces(): Promise<province[]> {
    return [
      {"name": "تهران", "code": "1"},
      {"name": "اردبیل", "code": "26"},
      {"name": "آذربایجان غربی", "code": "3"},
      {"name": "مرکزی", "code": "4"},
      {"name": "اصفهان", "code": "2"},
      {"name": "خوزستان", "code": "5"},
      {"name": "ایلام", "code": "29"},
      {"name": "بوشهر", "code": "20"},
      {"name": "آذربایجان شرقی", "code": "6"},
      {"name": "لرستان", "code": "30"},
      {"name": "گیلان", "code": "16"},
    ];
  }

  async loadProvinces(): Promise<province[]> {
    const filePath = `${this.manifest.dir}/data/iranian_province.json`; // تنظیم مسیر فایل

    try {
        const fileData = await this.app.vault.adapter.read(filePath);
        const cities: province[] = JSON.parse(fileData);

        // فیلتر کردن مقادیر نامعتبر
        const validCities = cities.filter(province => province.name && province.code && !isNaN(Number(province.code)));
        if (validCities.length === 0) {
            new Notice("هیچ شهر معتبری پیدا نشد.");
        }
        return validCities;
    } catch (error) {
        new Notice("خطا در خواندن فایل لیست شهر‌ها");
        return this.loadDefaultProvinces();
    }
  }

  async fetchPrayerTimes(provinceCode: string): Promise<any> {
    const url = `https://prayer.aviny.com/api/prayertimes/${provinceCode}`;
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      new Notice("خطا در دریافت اوقات شرعی.");
      return null;
    }
  }
}

class PrayerTimesView extends ItemView {
  plugin: PrayerTimesPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: PrayerTimesPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_PRAYER_TIMES;
  }

  getIcon(): IconName {
      return "clock";
  }
  getDisplayText() {
    return "Prayer Times";
  }

  async onload() {
    const container = this.containerEl.children[1];
    container.empty();

    // ایجاد عنوان و تنظیم وسط‌چین
    const title = container.createEl("h3", { text: "اوقات شرعی", cls: "text_center"});
    title.style.textAlign = "center";

    // دریافت اوقات شرعی
    const provinceCode = this.plugin.settings.selectedprovinceCode;
    const timings = await this.plugin.fetchPrayerTimes(provinceCode);

      if (!timings) {
        container.createEl("h5", { text: "اوقات شرعی یافت نشد.", cls: "text_center" });
        const updateButton = container.createEl("button", {
            text: "بازنشانی ↻",
            cls: "update-province-button",
        });
        updateButton.addEventListener("click", async () => {
            await this.plugin.saveSettings();
            await this.onload(); // بازنشانی View
        });
        return;
      }

    // لیست اوقات شرعی
    const prayerTimesList = container.createEl("div", { cls: "prayer_times_list" });
    const displayedTimes = this.plugin.settings.displayedTimes;
    
    Object.entries(displayedTimes).forEach(([key, label]) => {
      if(label.display){
        const prayer_item = prayerTimesList.createDiv({cls: "prayer_itam"});

        prayer_item.createEl("p", {text: label.text, cls: "prayer_title"});
        prayer_item.createEl("p" , {text: timings[key] || "نامشخص" , cls: "prayer_value"});
      }
    });
    container.childNodes[0].textContent = `اوقات شرعی ${timings["CityName"]}`

    // دکمه بازنشانی
    const updateButton = container.createEl("button", {
        text: "بازنشانی",
        cls: "update-province-button",
    });
    updateButton.textContent = `بازنشانی ↻`;
    updateButton.style.direction = "rtl"; // راست‌چین
    updateButton.addEventListener("click", async () => {
        await this.plugin.saveSettings();
        await this.onload(); // بازنشانی View
    });
  }

  async onOpen() {
    
  }

  async onClose() {
    // هرگونه پاکسازی لازم
  }
}

class PrayerTimesSettingsTab extends PluginSettingTab {
  plugin: PrayerTimesPlugin;

  constructor(app: App, plugin: PrayerTimesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    
    // لیست اطلاعات اوقات شرعی
    Object.entries(DEFAULT_SETTINGS.displayedTimes).forEach(([key, label]) => {
      new Setting(containerEl)
        .setName(`نمایش ${label.text}`)
        .setClass("setting_toggle")
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.displayedTimes[key].display || false);
          toggle.onChange(async (value) => {
            this.plugin.settings.displayedTimes[key].display = value;
            await this.plugin.saveSettings();
          });
        });
    });
    
    containerEl.createEl("hr");
    containerEl.createEl("h3", { text: "انتخاب استان",  cls: "text_center"});

    // ایجاد باکس جستجو
    const searchBox = containerEl.createEl("input", {
      type: "text",
      placeholder: "استان مورد نظر را جستجو کنید...",
      cls: "search-box",
    });

    // ایجاد div برای لیست استان‌ها
    const provinceContainer = containerEl.createEl("div", { cls: "province-container" });

    // لیست استان‌ها
    const provinceList = provinceContainer.createEl("ul", { cls: "province-list" });

    // بارگذاری استان‌ها
    const cities = await this.plugin.loadProvinces();

    const renderCities = (filter: string) => {
      provinceList.empty();

      const filteredCities = cities.filter((province) => province.name.includes(filter));
      filteredCities.forEach((province) => {
        const listItem = provinceList.createEl("li");
        listItem.textContent = province.name;

        // بررسی و تنظیم استایل استان انتخاب‌شده
        if (this.plugin.settings.selectedprovinceCode === province.code) {
          listItem.classList.add("selected");
        }

        // مدیریت کلیک روی استان‌ها
        listItem.addEventListener("click", async () => {
          // حذف کلاس selected از تمام آیتم‌ها
          provinceList.querySelectorAll("li").forEach((item) => {
            item.classList.remove("selected");
          });

          // افزودن کلاس selected به آیتم کلیک‌شده
          listItem.classList.add("selected");

          // ذخیره استان انتخاب‌شده
          this.plugin.settings.selectedprovinceCode = province.code;
          await this.plugin.saveSettings();
          new Notice(`شهر ${province.name} انتخاب شد.`);
        });
      });

      // پیام در صورت نبود استان
      if (filteredCities.length === 0) {
        provinceList.createEl("li", { text: "هیچ شهری یافت نشد.", cls: "no-results" });
      }
    };

    renderCities("");

    // جستجو هنگام تایپ
    searchBox.addEventListener("input", () => {
      const query = searchBox.value.trim();
      renderCities(query);
    });
  }
}
