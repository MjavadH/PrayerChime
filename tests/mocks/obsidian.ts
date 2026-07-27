export class Notice {
	constructor(public readonly message: unknown) {}
}

export class ItemView {
	containerEl: HTMLElement;
	contentEl: HTMLElement;

	constructor() {
		this.containerEl = document.createElement("div");
		this.contentEl = document.createElement("div");
	}

	registerDomEvent(): void {}
}

export class Menu {
	addItem(callback: (item: MenuItem) => void): this {
		callback(new MenuItem());
		return this;
	}

	showAtMouseEvent(): void {}
}

class MenuItem {
	setTitle(): this {
		return this;
	}

	setChecked(): this {
		return this;
	}

	setIcon(): this {
		return this;
	}

	onClick(): this {
		return this;
	}
}

export class Plugin {}

export class PluginSettingTab {
	containerEl: HTMLElement;

	constructor() {
		this.containerEl = document.createElement("div");
	}
}

export class Setting {
	settingEl: HTMLElement;

	constructor(parent: HTMLElement) {
		this.settingEl = parent.createDiv?.() ?? document.createElement("div");
	}

	setName(): this {
		return this;
	}

	setDesc(): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	addDropdown(): this {
		return this;
	}

	addToggle(): this {
		return this;
	}
}

export const setIcon = (): void => {};
