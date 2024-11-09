import {WS} from './lib/conn.js';
import ready from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';

class ControlClass {
	#rpc: RPC;

	constructor(rpc: RPC) {
		this.#rpc = rpc;
	}
}

export type Control = InstanceType<typeof ControlClass>;

const base = new URL(window.location+"");

queue(() => ready);

window.WebSocket = class extends WebSocket{};
window.XMLHttpRequest = class extends XMLHttpRequest{};
base.protocol = base.protocol === "https" ? "wss" : "ws";

export default (url: string, fn: (c: Control) => Promise<void> ) => {
	return queue(() => WS("/socket").then(ws => {
		const rpc = new RPC(ws);

		return rpc.request("proxy", url)
		.then(() => fn(new ControlClass(rpc)))
		.finally(() => rpc.close());
	}));
}
