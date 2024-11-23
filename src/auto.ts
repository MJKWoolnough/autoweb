import {HTTPRequest, WS} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

export type MouseButton = "left" | "right" | "center" | "centre" | "middle" | "wheelDown" | "wheelUp" | "wheelLeft" | "wheelRight";

export type Request = {
	url: string;
	method: string;
	headers: Record<string, string[]>;
	body: BodyInit | null | undefined;
}

export type HookResponse = {
	code: number;
	headers: Record<string, string[] | string> | Map<string, string[] | string>;
	body: string;
}

queue(() => ready);

let windowX = 0, windowY = 0;

const f = fetch,
      rpc = new RPC(),
      originalPage = Array.from(document.documentElement.children),
      fixButton = (button?: MouseButton) => button === "centre" || button === "middle" ? "center" : button ?? "left",
      load = (path: string) => HTTPRequest(path, {"headers": {"Cache-Control": "no-cache, no-store, max-age=0"}}).then(x => {
		history.pushState(+new Date(), "", new URL(path, window.location + ""));

		document.documentElement.innerHTML = x;
      }),
      hooks = new Map<string, (req: Request) => HookResponse | null>(),
      control = Object.freeze({
	load,
	"jumpMouse": (x: number, y: number) => queue(() => rpc.request("jumpMouse", [windowX + x|0, windowY + y|0])),
	"moveMouse": (x: number, y: number) => queue(() => rpc.request("moveMouse", [windowX + x|0, windowY + y|0])),
	"clickMouse": (button?: MouseButton) => queue(() => rpc.request("clickMouse", fixButton(button))),
	"dblClickMouse": (button?: MouseButton) => queue(() => rpc.request("dblClickMouse", fixButton(button))),
	"mouseDown": (button?: MouseButton) => queue(() => rpc.request("mouseDown", fixButton(button))),
	"mouseUp": (button?: MouseButton) => queue(() => rpc.request("mouseUp", fixButton(button))),
	"keyPress": (key: string) => queue(() => rpc.request("keyPress", key)),
	"keyDown": (key: string) => queue(() => rpc.request("keyDown", key)),
	"keyUp": (key: string) => queue(() => rpc.request("keyUp", key)),
	"delay": (milli: number) => new Promise(fn => setTimeout(fn, milli)),
	"waitForAnimationFrame": () => {
		const {promise, resolve} = Promise.withResolvers();

		requestAnimationFrame(resolve);

		return promise;
	},
	"hook": (url: string, fn?: (req: Request) => HookResponse | null) => {
		const afn =  fn ? (req: Request) => {
			const resp = fn(req);

			if (resp) {
				resp.code ??= 200;
				resp.headers = Object.fromEntries((resp?.headers instanceof Map ? resp.headers.entries() : Object.entries(resp.headers ?? {})).map(([key, v]) => [key, v instanceof Array ? v : [v]]));
			}

			return resp;
		}: fn;

		rpc.register(url, afn);

		if (afn) {
			rpc.request("addHook", url).then(() => hooks.set(url, afn));
		} else {
			rpc.request("removeHook", url).then(() => hooks.delete(url));
		}
	}
      });

window.WebSocket = class extends WebSocket{};
window.XMLHttpRequest = class extends XMLHttpRequest{};
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => f(input, init);

window.addEventListener("click", (e: Event) => {
	let target = e.target as Element | null;

	while (target && !(target instanceof HTMLAnchorElement || target instanceof HTMLAreaElement || target instanceof SVGAElement)) {
		target = target.parentNode as Element;
	}

	const href = target?.getAttribute("href"),
	      url = href ? new URL(href, window.location + "") : null;

	if (url?.host === window.location.host) {
		load(href ?? "");

		e.preventDefault();
	}
});

export default (url: string, fn: (c: typeof control) => Promise<void>) => {
	return queue(() => WS("/socket").then(ws => rpc.reconnect(ws)))
	.then(async () => {
		windowX = windowY = 0;

		let found: [number, number] | null = null,
		    x = -(window.innerWidth >> 1), y = window.innerHeight >> 1;

		const div = document.createElement("div"),
		      [screenW, screenH] = await rpc.request<[number, number]>("getScreenSize");

		div.setAttribute("style", "position: absolute; top: 0; left: 0; right: 0; bottom: 0");

		document.body.replaceChildren(div);

		await control.waitForAnimationFrame();

		div.addEventListener("mouseenter", e => {
			found = [e.clientX, e.clientY];

			div.remove();

			e.preventDefault();
		}, {"once": true, "capture": true});

		do {
			x += window.innerWidth;

			if (x > screenW) {
				x = window.innerWidth >> 1;
				y += window.innerHeight;

				if (y > screenH) {
					alert("Could not find window.");

					div.remove();

					return Promise.reject("unable to find window");
				}
			}

			await control.jumpMouse(x, y);
			await control.delay(50);
		} while (!found);

		windowX = x - found[0] | 0;
		windowY = y - found[1] | 0;

		return control.jumpMouse(window.innerWidth >> 1, window.innerHeight >> 1);
	})
	.then(() => rpc.request("proxy", url))
	.then(() => fn(control))
	.catch(e => console.log(e))
	.finally(() => {
		rpc?.close();

		history.pushState(+new Date(), "", new URL("/", window.location + ""));
		document.documentElement.replaceChildren(...originalPage);
	});
}
