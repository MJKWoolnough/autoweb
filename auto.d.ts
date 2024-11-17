export type MouseButton = "left" | "right" | "center" | "centre" | "middle" | "wheelDown" | "wheelUp" | "wheelLeft" | "wheelRight";

export interface Control {
	load: (path: string) => Promise<void>;
	jumpMouse: (x: number, y: number) => Promise<void>;
	moveMouse: (x: number, y: number) => Promise<void>;
	clickMouse: (button?: MouseButton) => Promise<void>;
	dblClickMouse: (button?: MouseButton) => Promise<void>;
	mouseDown: (button?: MouseButton) => Promise<void>;
	mouseUp: (button?: MouseButton) => Promise<void>;
	keyPress: (key: string) => Promise<void>;
	keyDown: (key: string) => Promise<void>;
	keyUp: (key: string) => Promise<void>;
	delay: (milli: number) => Promise<void>;
	waitForAnimationFrame: () => Promise<void>;
}

declare const _default: (url: string, fn: (c: Control) => Promise<void>) => Promise<void>;

export default _default;
