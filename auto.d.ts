export type MouseButton = "left" | "right" | "center" | "centre" | "middle" | "wheelDown" | "wheelUp" | "wheelLeft" | "wheelRight";

export interface Control {
	moveMouse: (x: number, y: number) => Promise<void>;
	clickMouse: (button?: MouseButton) => Promise<void>;
	dblClickMouse: (button?: MouseButton) => Promise<void>;
	mouseDown: (button?: MouseButton) => Promise<void>;
}

declare const _default: (url: string, fn: (c: Control) => Promise<void>) => Promise<void>;

export default _default;
