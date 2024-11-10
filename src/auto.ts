import {WS} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

queue(() => ready);

let rpc: RPC | null = null;

const f = fetch,
      control = Object.freeze({});

window.WebSocket = class extends WebSocket{};
window.XMLHttpRequest = class extends XMLHttpRequest{};
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => f(input, init);

export default (url: string, fn: (c: typeof control) => Promise<void> ) => {
	return queue(() => WS("/socket").then(ws => {
		rpc = new RPC(ws);

		return rpc.request("proxy", url)
		.then(() => fn(control))
		.finally(() => rpc?.close());
	}));
}
