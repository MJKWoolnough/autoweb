import {WS} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

queue(() => ready);

let windowX = 0, windowY = 0;

const f = fetch,
      rpc = new RPC(),
      control = Object.freeze({
	      "moveMouse": (x: number, y: number) => queue(() => rpc.request("moveMouse", [windowX + x|0, windowY + y|0]) ?? Promise.reject)
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
