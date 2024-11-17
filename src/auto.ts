import {WS, HTTPRequest} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

export type MouseButton = "left" | "right" | "center" | "centre" | "middle" | "wheelDown" | "wheelUp" | "wheelLeft" | "wheelRight";

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
	"delay": (milli: number) => new Promise(fn => setTimeout(fn, milli))
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
	.then(() => rpc.request("proxy", url))
	.then(() => fn(control))
	.catch(e => console.log(e))
	.finally(() => {
		rpc?.close();

		history.pushState(+new Date(), "", new URL("/", window.location + ""));
		document.documentElement.replaceChildren(...originalPage);
	});
}
