/**
 * CelestialSky
 * -------------------------------------------------------------
 * A self-contained, real-time 24h sky dial for the PrayerChime header.
 *
 * It renders:
 *   - an elliptical orbit track (visible arc above the horizon, ghost arc below)
 *   - a progress arc that fills as the active body travels its arc
 *   - prayer-time tick markers placed on the active arc
 *   - a horizon line whose glow reacts to twilight
 *   - a twinkling star field + drifting meteor (night) and soft clouds (day)
 *   - the sun (rotating corona) and the moon (real lunar phase shading)
 *
 * All positions are expressed in a 0..100 coordinate space so the SVG paths
 * and the HTML bodies stay perfectly aligned regardless of header size.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* Orbit geometry (0..100 space) */
const CX = 50;
const BASE_Y = 86; // horizon line
const RX = 47;
const RY = 62; // above-horizon amplitude
const UNDER_RY = 22; // below-horizon (ghost) amplitude
const ARC_SAMPLES = 72;

const DAY_MS = 24 * 60 * 60 * 1000;
const TWILIGHT_MS = 40 * 60 * 1000;

/* Lunar phase reference: new moon 2000-01-06 18:14 UTC */
const SYNODIC_MONTH_MS = 29.530588853 * DAY_MS;
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

export interface SkyMarker {
	key: string;
	label: string;
	timestamp: number;
}

export interface SkyState {
	now: number;
	sunrise: number;
	sunset: number;
	/** Sunset that opened the current/previous night. */
	prevSunset: number;
	/** Sunrise that closes the current/next night. */
	nextSunrise: number;
	markers: SkyMarker[];
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
	if (edge1 === edge0) return value >= edge1 ? 1 : 0;
	const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return x * x * (3 - 2 * x);
};

/**
 * Position on the orbit for progress `p` (0 = rise point, 1 = set point).
 * The dial runs left-to-right: bodies rise on the left edge, culminate at the
 * centre and set on the right edge.
 */
const pointAt = (p: number, ry: number, below: boolean): { x: number; y: number } => {
	const angle = Math.PI * clamp(p, 0, 1);
	const x = CX - RX * Math.cos(angle);
	const y = below ? BASE_Y + ry * Math.sin(angle) : BASE_Y - ry * Math.sin(angle);
	return { x, y };
};

const arcPath = (ry: number, below: boolean): string => {
	let d = "";
	for (let i = 0; i <= ARC_SAMPLES; i++) {
		const { x, y } = pointAt(i / ARC_SAMPLES, ry, below);
		d += `${i === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`;
	}
	return d;
};

/** Deterministic pseudo-random in [0,1) so the star field never re-shuffles. */
const hashRandom = (seed: number): number => {
	const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const moonPhase = (now: number): { illumination: number; waxing: boolean } => {
	const age = (((now - NEW_MOON_EPOCH) % SYNODIC_MONTH_MS) + SYNODIC_MONTH_MS) % SYNODIC_MONTH_MS;
	const phase = age / SYNODIC_MONTH_MS; // 0 = new, 0.5 = full
	return {
		illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2,
		waxing: phase < 0.5,
	};
};

export class CelestialSky {
	private readonly root: HTMLElement;

	private readonly tickLayer: HTMLElement;
	private readonly sunEl: HTMLElement;
	private readonly moonEl: HTMLElement;
	private readonly moonShadowEl: HTMLElement;
	private tickSignature = "";

	constructor(parent: HTMLElement) {
		this.root = parent.createDiv({
			cls: "pc-sky",
			attr: { "aria-hidden": "true" },
		});

		/* Atmosphere layers (pure CSS, driven by --pc-daylight / --pc-twilight) */
		this.root.createDiv({ cls: "pc-sky__atmos" });
		this.root.createDiv({ cls: "pc-sky__glow" });

		/* Stars */
		const stars = this.root.createDiv({ cls: "pc-sky__stars" });
		for (let i = 0; i < 34; i++) {
			const star = stars.createDiv({ cls: "pc-sky__star" });
			const size = 1 + hashRandom(i * 3.3) * 1.6;
			star.style.left = `${(hashRandom(i * 1.7) * 100).toFixed(2)}%`;
			star.style.top = `${(hashRandom(i * 5.1) * 72).toFixed(2)}%`;
			star.style.width = `${size.toFixed(2)}px`;
			star.style.height = `${size.toFixed(2)}px`;
			star.style.setProperty("--pc-star-delay", `${(hashRandom(i * 9.4) * 6).toFixed(2)}s`);
			star.style.setProperty(
				"--pc-star-duration",
				`${(2.6 + hashRandom(i * 2.2) * 3.4).toFixed(2)}s`,
			);
			star.style.setProperty("--pc-star-peak", `${(0.35 + hashRandom(i * 7.7) * 0.65).toFixed(2)}`);
		}
		this.root.createDiv({ cls: "pc-sky__meteor" });

		/* Clouds */
		const clouds = this.root.createDiv({ cls: "pc-sky__clouds" });
		clouds.createDiv({ cls: "pc-sky__cloud pc-sky__cloud--a" });
		clouds.createDiv({ cls: "pc-sky__cloud pc-sky__cloud--b" });

		/* Orbit */
		const svg = document.createElementNS(SVG_NS, "svg");
		svg.classList.add("pc-sky__svg");
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");
		svg.setAttribute("focusable", "false");

		const under = document.createElementNS(SVG_NS, "path");
		under.classList.add("pc-sky__orbit", "pc-sky__orbit--under");
		under.setAttribute("d", arcPath(UNDER_RY, true));
		under.setAttribute("vector-effect", "non-scaling-stroke");
		svg.appendChild(under);

		const track = document.createElementNS(SVG_NS, "path");
		track.classList.add("pc-sky__orbit", "pc-sky__orbit--track");
		track.setAttribute("d", arcPath(RY, false));
		track.setAttribute("vector-effect", "non-scaling-stroke");
		svg.appendChild(track);

		this.root.appendChild(svg);

		this.root.createDiv({ cls: "pc-sky__scrim" });
		this.root.createDiv({ cls: "pc-sky__horizon" });
		this.tickLayer = this.root.createDiv({ cls: "pc-sky__ticks" });

		/* Sun */
		this.sunEl = this.root.createDiv({ cls: "pc-sky__body pc-sky__body--sun" });
		this.sunEl.createDiv({ cls: "pc-sky__sun-rays" });
		this.sunEl.createDiv({ cls: "pc-sky__sun-halo" });
		this.sunEl.createDiv({ cls: "pc-sky__sun-core" });

		/* Moon */
		this.moonEl = this.root.createDiv({ cls: "pc-sky__body pc-sky__body--moon" });
		this.moonEl.createDiv({ cls: "pc-sky__moon-halo" });
		const disc = this.moonEl.createDiv({ cls: "pc-sky__moon-disc" });
		disc.createDiv({ cls: "pc-sky__moon-crater pc-sky__moon-crater--a" });
		disc.createDiv({ cls: "pc-sky__moon-crater pc-sky__moon-crater--b" });
		disc.createDiv({ cls: "pc-sky__moon-crater pc-sky__moon-crater--c" });
		this.moonShadowEl = disc.createDiv({ cls: "pc-sky__moon-shadow" });
	}

	update(state: SkyState): void {
		const { now, sunrise, sunset } = state;
		if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) return;

		const isDay = now >= sunrise && now < sunset;
		const nightStart = now < sunrise ? state.prevSunset : sunset;
		const nightEnd = now < sunrise ? sunrise : state.nextSunrise;

		const dayProgress = clamp((now - sunrise) / (sunset - sunrise), 0, 1);
		const nightProgress =
			nightEnd > nightStart ? clamp((now - nightStart) / (nightEnd - nightStart), 0, 1) : 0;

		/* Signed altitude: +1 solar zenith, -1 deep night. */
		const altitude = isDay
			? Math.sin(Math.PI * dayProgress)
			: -0.92 * Math.sin(Math.PI * nightProgress);

		const daylight = smoothstep(-0.1, 0.22, altitude);
		const twilight = clamp(1 - Math.abs(altitude - 0.02) / 0.26, 0, 1);
		const dawnBlend = smoothstep(sunrise - TWILIGHT_MS, sunrise + TWILIGHT_MS, now);
		const duskBlend = 1 - smoothstep(sunset - TWILIGHT_MS, sunset + TWILIGHT_MS, now);

		/* Body placement: one continuous wheel. The active body rides the visible
		   arc left -> right, while the dormant body sits 180 deg behind on the
		   sub-horizon arc (travelling right -> left) so that the instant the sun
		   sets on the right, the moon is already rising on the left. No jumps. */
		const sunPos = isDay
			? pointAt(dayProgress, RY, false)
			: pointAt(1 - nightProgress, UNDER_RY, true);
		const moonPos = isDay
			? pointAt(1 - dayProgress, UNDER_RY, true)
			: pointAt(nightProgress, RY, false);

		const sunOpacity = isDay ? clamp(Math.min(dawnBlend, duskBlend), 0.15, 1) : 0.14;
		const moonOpacity = isDay ? 0.12 : clamp(1 - Math.min(dawnBlend, duskBlend) * 0.85, 0.4, 1);

		this.setVars({
			"--pc-sun-x": `${sunPos.x.toFixed(3)}%`,
			"--pc-sun-y": `${sunPos.y.toFixed(3)}%`,
			"--pc-moon-x": `${moonPos.x.toFixed(3)}%`,
			"--pc-moon-y": `${moonPos.y.toFixed(3)}%`,
			"--pc-sun-opacity": sunOpacity.toFixed(3),
			"--pc-moon-opacity": moonOpacity.toFixed(3),
			"--pc-sun-scale": (0.86 + Math.max(altitude, 0) * 0.22).toFixed(3),
			"--pc-daylight": daylight.toFixed(3),
			"--pc-nightness": (1 - daylight).toFixed(3),
			"--pc-twilight": twilight.toFixed(3),
			"--pc-altitude": altitude.toFixed(3),
		});

		this.root.toggleClass("is-day", isDay);
		this.root.toggleClass("is-night", !isDay);

		/* Lunar phase */
		const { illumination, waxing } = moonPhase(now);
		this.moonShadowEl.style.setProperty(
			"--pc-moon-shadow-x",
			`${((waxing ? -1 : 1) * illumination * 100).toFixed(2)}%`,
		);
		this.moonShadowEl.style.setProperty("--pc-moon-lit", illumination.toFixed(3));

		this.renderTicks(state, isDay, nightStart, nightEnd);
	}

	private renderTicks(state: SkyState, isDay: boolean, nightStart: number, nightEnd: number): void {
		const from = isDay ? state.sunrise : nightStart;
		const to = isDay ? state.sunset : nightEnd;
		if (to <= from) return;

		const visible = state.markers
			.filter((m) => m.timestamp > from && m.timestamp < to)
			.sort((a, b) => a.timestamp - b.timestamp);

		const signature = `${isDay ? "d" : "n"}:${visible.map((m) => `${m.key}@${m.timestamp}`).join(",")}`;
		if (signature !== this.tickSignature) {
			this.tickSignature = signature;
			this.tickLayer.empty();
			for (const marker of visible) {
				const p = clamp((marker.timestamp - from) / (to - from), 0, 1);
				const pos = pointAt(p, RY, false);
				const tick = this.tickLayer.createDiv({
					cls: "pc-sky__tick",
					attr: { "data-key": marker.key, title: marker.label },
				});
				tick.style.left = `${pos.x.toFixed(3)}%`;
				tick.style.top = `${pos.y.toFixed(3)}%`;
				tick.createDiv({ cls: "pc-sky__tick-dot" });
			}
		}

		/* Passed / active state is cheap to refresh every tick. */
		const nodes = Array.from(this.tickLayer.children) as HTMLElement[];
		visible.forEach((marker, index) => {
			const node = nodes[index];
			if (!node) return;
			node.toggleClass("is-passed", state.now >= marker.timestamp);
			node.toggleClass("is-imminent", Math.abs(state.now - marker.timestamp) <= 15 * 60 * 1000);
		});
	}

	private setVars(vars: Record<string, string>): void {
		for (const [name, value] of Object.entries(vars)) {
			this.root.style.setProperty(name, value);
		}
	}

	destroy(): void {
		this.root.remove();
	}
}
