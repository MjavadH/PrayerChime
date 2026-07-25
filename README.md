# PrayerChime

**PrayerChime** is an offline, Persian-first [Obsidian](https://obsidian.md) plugin that shows Islamic prayer times for cities in Iran. It uses the bundled Iranian city dataset and local calculation code, so daily prayer times are available without calling an external API.

The plugin is now available in **Obsidian Community Plugins**. Installing from Community Plugins is the recommended installation method.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Getting started](#getting-started)
- [How it works](#how-it-works)
- [Settings](#settings)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Persian README](REAME-FA.md)

## Features

- **Offline prayer times** for Iranian cities using local coordinates and built-in solar calculations.
- **No external prayer-time API** is required for normal use.
- **Persian and RTL interface** for the main view and settings page.
- **Obsidian ribbon action** to open the PrayerChime view.
- **Dedicated right-sidebar view** with today’s Persian date, selected city, prayer-time list, next time, and countdown.
- **Status bar item** that can show the next upcoming prayer time.
- **City search** across city, county/province, and state names.
- **Favorite cities** for faster switching from the settings page.
- **Configurable calculation method**: Tehran, Jafari, ISNA, MWL, or Umm al-Qura.
- **Configurable warning interval** for the “approaching” visual state.
- **Configurable visible items** for Fajr, sunrise, Dhuhr, Asr, sunset, Maghrib, Isha, and Islamic midnight.
- **Automatic UI refresh** while the PrayerChime view is open.
- **Desktop and mobile support** where Obsidian supports community plugins.

## Installation

### Recommended: install from Community Plugins

PrayerChime has been published in Obsidian Community Plugins, so this is the preferred way to install and update it.

1. Open **Settings** in Obsidian.
2. Go to **Community plugins**.
3. If community plugins are disabled, enable them according to Obsidian’s prompt.
4. Click **Browse**.
5. Search for **PrayerChime**.
6. Click **Install**.
7. Click **Enable**.

### Manual installation

Use manual installation only if you need to test a local build or install a release outside Community Plugins.

1. Download or build the plugin files.
2. Create this folder in your vault:

   ```text
   <Vault>/.obsidian/plugins/prayer-chime/
   ```

3. Copy these files into that folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Restart Obsidian or run **Reload app without saving** from the command palette.
5. Enable **PrayerChime** from **Settings → Community plugins**.

## Getting started

1. Install and enable PrayerChime.
2. Click the **PrayerChime** ribbon icon, or open the PrayerChime view from Obsidian.
3. Open **Settings → PrayerChime**.
4. Select your preferred calculation method if the default Tehran method is not what you need.
5. Search for your city or province and select the city.
6. Optionally star cities to add them to favorites.
7. Choose which prayer-time entries should be shown.
8. Use the refresh button in the PrayerChime view whenever you want to redraw the view immediately.

If no valid city is selected, PrayerChime falls back to Tehran.

## How it works

PrayerChime loads Iranian city data from `src/data/iran-dataset.json`, normalizes the dataset, and assigns each city a stable ID derived from its state, province, city name, latitude, and longitude.

Prayer times are calculated locally for the current Tehran date and formatted in the `Asia/Tehran` time zone. The view then renders enabled prayer-time items in this order:

1. Fajr
2. Sunrise
3. Dhuhr
4. Asr
5. Sunset
6. Maghrib
7. Isha
8. Islamic midnight

The PrayerChime view updates item states every few seconds:

- **Upcoming**: the time is later today.
- **Approaching**: the time is within the configured warning interval.
- **Now**: the time is within the active threshold around the calculated timestamp.
- **Past**: the active threshold has passed.

## Settings

Open **Settings → PrayerChime** to configure the plugin.

### General settings

- **Calculation method**
  - Tehran / Institute of Geophysics, University of Tehran
  - Jafari / Shia Ithna Ashari
  - ISNA
  - MWL
  - Umm al-Qura
- **Show in status bar**: show or hide the next prayer time in Obsidian’s status bar.
- **Warning interval**: choose when the view should mark a time as approaching: 5, 10, 15, or 30 minutes before the time.

### Displayed times

Enable or disable each displayed item:

- Fajr
- Sunrise
- Dhuhr
- Asr
- Sunset
- Maghrib
- Isha
- Islamic midnight

### City picker

- Search by city, county/province, or state.
- Select a city from the result list.
- Star cities to keep them in the favorites row.
- Remove a favorite with the `x` button on the favorite chip.

## Privacy

PrayerChime does not send your location, city selection, vault contents, or prayer-time settings to any external service. City data is bundled with the plugin, prayer times are calculated locally, and plugin preferences are stored through Obsidian’s normal plugin data storage in your vault.

## Troubleshooting

### PrayerChime does not appear

- Confirm that the plugin is installed and enabled in **Settings → Community plugins**.
- Click the PrayerChime ribbon icon.
- Check the right sidebar.
- Reload Obsidian if the view was not registered after installation.

### My city is not found

- Search using the Persian spelling.
- Search by province or state name.
- If the city is missing from the bundled dataset, please open an issue or pull request.

### Times look wrong

- Confirm that the selected city is correct.
- Confirm that the selected calculation method matches your preference.
- Check whether the displayed time item is sunset or Maghrib; depending on the calculation method, these may differ.

### Nothing is shown in the view

- Make sure at least one prayer-time item is enabled in settings.
- Reload Obsidian.
- If you installed manually, confirm that `main.js`, `manifest.json`, and `styles.css` are in the plugin folder.

## Development

### Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/) because the project declares `pnpm@11.16.0` as its package manager
- An Obsidian vault for manual testing

### Install dependencies

```bash
pnpm install
```

### Development build

```bash
pnpm run dev
```

### Production build

```bash
pnpm run build
```

### Run tests

```bash
pnpm test
```

### Lint and format

```bash
pnpm run lint
```

### Version bump

```bash
pnpm run version
```

## Project structure

```text
.
├── README.md                    # English documentation
├── REAME-FA.md                  # Persian documentation
├── manifest.json                # Obsidian plugin manifest
├── package.json                 # Scripts, metadata, and dev dependencies
├── styles.css                   # Plugin view and settings styles
├── tests/                       # Vitest test suite
└── src/
    ├── core/
    │   ├── constants.ts         # View IDs, timing constants, ordering, and icons
    │   └── settings.ts          # Default settings and settings normalization
    ├── data/
    │   └── iran-dataset.json    # Bundled Iranian city dataset
    ├── services/
    │   ├── adhan.ts             # Local prayer-time calculation primitives
    │   ├── city-service.ts      # City dataset parsing, fallback, and search
    │   └── prayer-service.ts    # Calculation orchestration and time formatting
    ├── settings/
    │   └── settings-tab.ts      # Obsidian settings UI
    ├── types/
    │   └── index.ts             # Shared TypeScript types
    ├── utils/
    │   ├── date.ts              # Tehran date/time constants
    │   └── format.ts            # Persian digits, countdown, and date formatting
    ├── views/
    │   └── prayer-times-view.ts # Obsidian item view renderer
    └── main.ts                  # Plugin entry point
```

## Contributing

Contributions are welcome. Useful contributions include bug reports, feature requests, dataset fixes, documentation improvements, tests, and focused pull requests.

Before opening a pull request, run:

```bash
pnpm run build
pnpm test
```

## License

PrayerChime is released under the **MIT License**.
