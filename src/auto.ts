import {WS} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

export type MouseButton = "left" | "right" | "center" | "centre" | "middle" | "wheelDown" | "wheelUp" | "wheelLeft" | "wheelRight";

queue(() => ready);

let windowX = 0, windowY = 0;

const f = fetch,
      rpc = new RPC(),
      fixButton = (button?: MouseButton) => button === "centre" || button === "middle" ? "center" : button ?? "left",
      control = Object.freeze({
	      "moveMouse": (x: number, y: number) => queue(() => rpc.request("moveMouse", [windowX + x|0, windowY + y|0])),
	      "clickMouse": (button?: MouseButton) => queue(() => rpc.request("clickMouse", fixButton(button))),
	      "dblClickMouse": (button?: MouseButton) => queue(() => rpc.request("dblClickMouse", fixButton(button))),
	      "mouseDown": (button?: MouseButton) => queue(() => rpc.request("mouseDown", fixButton(button))),
	      "mouseUp": (button?: MouseButton) => queue(() => rpc.request("mouseUp", fixButton(button)))
      });

window.WebSocket = class extends WebSocket{};
window.XMLHttpRequest = class extends XMLHttpRequest{};
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => f(input, init);

export default (url: string, fn: (c: typeof control) => Promise<void>) => {
	return queue(() => WS("/socket").then(ws => {
		rpc.reconnect(ws);

		return rpc.request("proxy", url)
		.then(() => fn(control))
		.finally(() => rpc?.close());
	}));
}
