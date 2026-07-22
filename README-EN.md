# PrayerChime

## Overview

**PrayerChime** is a lightweight, offline, right-to-left friendly [Obsidian](https://obsidian.md) plugin for displaying Islamic prayer times for cities in Iran. It uses local city data and built-in prayer-time calculations, so it does not depend on an external API to show daily times.

The plugin is designed for users who want quick access to prayer times while writing notes, planning their day, studying, or working inside Obsidian.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Settings](#settings)
- [Development](#development)
- [Project Structure](#project-structure)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Offline prayer-time calculation** using local city coordinates.
- **Iranian city support** through the bundled `data/iran-dataset.json` dataset.
- **Fast city search** across city, province, and state/region names.
- **Dedicated Obsidian view** that opens in the right sidebar.
- **Customizable displayed times** for each prayer-time item.
- **Visual time status** for past, upcoming, and current prayer times.
- **Manual and scheduled refresh** with a refresh button and automatic midnight refresh based on Tehran time.
- **Desktop and mobile compatibility** where supported by Obsidian.
- **Persian-first UI** with right-to-left layout styles.

## Installation

### Install from Community Plugins

> Use this method if PrayerChime is available in the official Obsidian Community Plugins directory.

1. Open **Settings** in Obsidian.
2. Go to **Community plugins**.
3. Click **Browse**.
4. Search for **PrayerChime**.
5. Install and enable the plugin.

### Manual Installation

1. Download the latest built release of the plugin.
2. Create this folder inside your vault:

   ```text
   <Vault>/.obsidian/plugins/prayer-chime/
   ```

3. Copy the plugin files into that folder. The required files are typically:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `data/iran-dataset.json`
4. Reload Obsidian or restart the app.
5. Enable **PrayerChime** from **Settings → Community plugins**.

## Quick Start

1. Enable the plugin in Obsidian.
2. Open **Settings → PrayerChime**.
3. Search for and select your city.
4. Choose which prayer-time entries should be displayed.
5. Open the PrayerChime view in the right sidebar.
6. Use **بازنشانی ↻** to refresh the displayed times manually.

## Usage

### Select a City

- Open **Settings → PrayerChime**.
- Type a city or province name in the search box.
- Select the desired city from the results.
- Open PrayerChime to see the updated times.

### View Prayer Times

The PrayerChime view displays each enabled item with:

- a contextual icon,
- a Persian label,
- the calculated time formatted for Tehran time.

### Time Statuses

PrayerChime highlights items during the day:

- **Upcoming**: 10 minutes or less before the time.
- **Current**: when the time has just arrived.
- **Past**: after the active window has passed.

## Settings

You can enable or disable these displayed entries:

- Fajr
- Sunrise
- Dhuhr
- Asr
- Sunset
- Maghrib
- Isha
- Islamic midnight

If no valid city is selected, or if the city dataset cannot be loaded, PrayerChime falls back to Tehran.

## Development

### Requirements

- [Node.js](https://nodejs.org/)
- npm
- An Obsidian vault for local testing

### Install Dependencies

```bash
npm install
```

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Version Bump

```bash
npm run version
```

## Project Structure

```text
.
├── adhan.ts                 # Prayer-time calculation logic
├── city-service.ts          # City loading, validation, and search
├── data/iran-dataset.json   # Local Iranian city dataset
├── main.ts                  # Plugin entry point, view, and settings UI
├── prayer-service.ts        # Display-ready prayer-time preparation
├── styles.css               # Plugin view and settings styles
├── types.ts                 # TypeScript types
├── manifest.json            # Obsidian plugin manifest
└── package.json             # Development scripts and dependencies
```

## Privacy

PrayerChime does not require an external API for prayer-time calculation. It reads city data from the bundled local dataset. User preferences, such as the selected city and visible prayer-time entries, are stored through Obsidian's plugin data storage in the user's vault.

## Troubleshooting

### I cannot see the PrayerChime view

- Make sure the plugin is enabled.
- Reload Obsidian.
- Check the right sidebar.

### My city is not listed

- Try searching with the Persian spelling.
- Try searching by province name.
- If the city is missing from the dataset, consider opening an issue or submitting a pull request.

### Prayer times are not displayed

- Confirm that `data/iran-dataset.json` exists in the plugin folder.
- Reinstall the built plugin files.
- Check the Obsidian developer console for errors.

## Contributing

Contributions are welcome. You can help by:

- reporting bugs,
- suggesting new features,
- improving the city dataset,
- improving documentation,
- opening focused pull requests with clear descriptions.

Before submitting a pull request, run:

```bash
npm run build
```

## License

This project is released under the **MIT License**.
