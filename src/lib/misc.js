"use strict";
/**
 * The misc module contains various simple, dependency-free functions.
 *
 * @module misc
 */
/** */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Callable = exports.debounce = exports.stringSort = exports.text2DOM = exports.autoFocus = exports.queue = exports.addAndReturn = exports.pushAndReturn = exports.setAndReturn = exports.mod = exports.checkInt = exports.isInt = void 0;
var 
/**
 * This function determines whether `v` is a valid integer in the range provided (min <= v <= max).
 *
 * NB: Infinity is not a valid integer.
 *
 * @param {unknown} v               Value to be checked.
 * @param {number}  [min=-Infinity] Minimum acceptable value.
 * @param {number}  [max=+Infinity] Maximum acceptable value.
 *
 * @return {boolean} `true` if `v` is an integer between `min` and `max` inclusive.
 */
isInt = function (v, min, max) {
    if (min === void 0) { min = -Infinity; }
    if (max === void 0) { max = Infinity; }
    return typeof v === "number" && (v | 0) === v && v >= min && v <= max;
}, 
/**
 * This function determines whether `n` is a valid integer, as determined by the {@link isInt} function, and returns `n` if it is, or `def` otherwise.
 *
 * @param {unknown} n                      The value to be checked.
 * @param {number}  [min=-Infinity]        Minimum acceptable value.
 * @param {number}  [max=+Infinity]        Maximum acceptable value.
 * @param {number}  [def=Math.max(min, 0)] Default value to be returned if `n` is unacceptable.
 *
 * @return {number} The number `n` if it is an integer between `min` and `max` inclusively, or `def` (cast to an integer) otherwise.
 */
checkInt = function (n, min, max, def) {
    if (min === void 0) { min = -Infinity; }
    if (max === void 0) { max = Infinity; }
    if (def === void 0) { def = Math.max(min, 0); }
    return (0, exports.isInt)(n, min, max) ? n : def | 0;
}, 
/**
 * Modulo function.
 *
 * @param {number} n
 * @param {number} m
 *
 * @return {number} The modulo of `n % m`.
 */
mod = function (n, m) { return ((n % m) + m) % m; }, 
/**
 * This function sets a value in a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map | Map}-like structure and returns the value.
 *
 * @typeParam K
 * @typeParam V
 * @param {{set: (K, V) => void}} m Map-like object.
 * @param {K}                     k Key for where value is to be stored.
 * @param {V}                     v Value to be stored.
 *
 * @return {V} The value `v`.
 */
setAndReturn = function (m, k, v) {
    m.set(k, v);
    return v;
}, 
/**
 * This functions pushes a value to a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array | Array}-like structure and returns the value.
 *
 * @typeParam V
 * @param {{push: (V) => void}} a The Array-like object to push to.
 * @param {V}                   v The value to be pushed.
 *
 * @return {V} The value `v`.
 */
pushAndReturn = function (a, v) {
    a.push(v);
    return v;
}, 
/**
 * This functions adds a value to a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set | Set}-like structure and returns the value.
 *
 * @typeParam V
 * @param {{add: (V) => void}} a The Set-like object to add to.
 * @param {V}                  v The value to be added.
 *
 * @return {V} The value `v`.
 */
addAndReturn = function (s, v) {
    s.add(v);
    return v;
}, 
/**
 * This function will schedule an element to be focused after the after the current event loop finishes. If the element is an {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement | HTMLInputElement} or a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement | HTMLTextAreaElement} the element will also be selected unless the `inputSelect` param is set to false.
 *
 * @typeParam {{focus(): void}} T
 * @param {T}       node               The Node to be focused.
 * @param {boolean} [inputSelect=true] Set to false to stop HTMLInputElements and HTMLTextAreaElements from being `selected`.
 *
 * @return {T} The passed node.
 */
autoFocus = function (node, inputSelect) {
    if (inputSelect === void 0) { inputSelect = true; }
    window.setTimeout(function () {
        node.focus();
        if ((node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) && inputSelect) {
            node.select();
        }
    });
    return node;
}, 
/**
 * This function converts valid HTML/SVG/MathML text into DOM Nodes.
 *
 * @param {string} text The text to be converted.
 *
 * @return {DocumentFragment} The parsed DOM nodes stored in a {@link https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment | DocumentFragment}.
 */
text2DOM = function (text) {
    var t = document.createElement("template");
    t.innerHTML = text;
    return t.content;
}, 
/**
 * This function prevents a updates from happening too often by limiting how often they can run.
 *
 * @param {number}  [timer=0]     Timeout in milliseconds before another update can run.
 * @param {boolean} [first=false] Flag to determine whether or not the first or last update function should be run.
 *
 * @return {(fn: Function) => void} A function which takes the update function that will be debounced.
 */
debounce = function (timer, first) {
    if (timer === void 0) { timer = 0; }
    if (first === void 0) { first = false; }
    var bouncing = -1;
    return function (fn) {
        if (bouncing >= 0) {
            if (first) {
                return;
            }
            clearTimeout(bouncing);
        }
        bouncing = setTimeout(function () {
            fn();
            bouncing = -1;
        }, timer);
    };
};
/**
 * This function determines whether `v` is a valid integer in the range provided (min <= v <= max).
 *
 * NB: Infinity is not a valid integer.
 *
 * @param {unknown} v               Value to be checked.
 * @param {number}  [min=-Infinity] Minimum acceptable value.
 * @param {number}  [max=+Infinity] Maximum acceptable value.
 *
 * @return {boolean} `true` if `v` is an integer between `min` and `max` inclusive.
 */
exports.isInt = isInt, 
/**
 * This function determines whether `n` is a valid integer, as determined by the {@link isInt} function, and returns `n` if it is, or `def` otherwise.
 *
 * @param {unknown} n                      The value to be checked.
 * @param {number}  [min=-Infinity]        Minimum acceptable value.
 * @param {number}  [max=+Infinity]        Maximum acceptable value.
 * @param {number}  [def=Math.max(min, 0)] Default value to be returned if `n` is unacceptable.
 *
 * @return {number} The number `n` if it is an integer between `min` and `max` inclusively, or `def` (cast to an integer) otherwise.
 */
exports.checkInt = checkInt, 
/**
 * Modulo function.
 *
 * @param {number} n
 * @param {number} m
 *
 * @return {number} The modulo of `n % m`.
 */
exports.mod = mod, 
/**
 * This function sets a value in a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map | Map}-like structure and returns the value.
 *
 * @typeParam K
 * @typeParam V
 * @param {{set: (K, V) => void}} m Map-like object.
 * @param {K}                     k Key for where value is to be stored.
 * @param {V}                     v Value to be stored.
 *
 * @return {V} The value `v`.
 */
exports.setAndReturn = setAndReturn, 
/**
 * This functions pushes a value to a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array | Array}-like structure and returns the value.
 *
 * @typeParam V
 * @param {{push: (V) => void}} a The Array-like object to push to.
 * @param {V}                   v The value to be pushed.
 *
 * @return {V} The value `v`.
 */
exports.pushAndReturn = pushAndReturn, 
/**
 * This functions adds a value to a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set | Set}-like structure and returns the value.
 *
 * @typeParam V
 * @param {{add: (V) => void}} a The Set-like object to add to.
 * @param {V}                  v The value to be added.
 *
 * @return {V} The value `v`.
 */
exports.addAndReturn = addAndReturn, 
/**
 * This function queues the passed function to be run after all previous calls to this function.
 *
 * @param {() => Promise<any>} fn The function to be queued.
 *
 * @return {Promise<void>} Promise that resolves after function runs.
 */
exports.queue = (function () {
    var p = Promise.resolve();
    return function (fn) { return p = p.finally(fn); };
})(), 
/**
 * This function will schedule an element to be focused after the after the current event loop finishes. If the element is an {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement | HTMLInputElement} or a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement | HTMLTextAreaElement} the element will also be selected unless the `inputSelect` param is set to false.
 *
 * @typeParam {{focus(): void}} T
 * @param {T}       node               The Node to be focused.
 * @param {boolean} [inputSelect=true] Set to false to stop HTMLInputElements and HTMLTextAreaElements from being `selected`.
 *
 * @return {T} The passed node.
 */
exports.autoFocus = autoFocus, 
/**
 * This function converts valid HTML/SVG/MathML text into DOM Nodes.
 *
 * @param {string} text The text to be converted.
 *
 * @return {DocumentFragment} The parsed DOM nodes stored in a {@link https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment | DocumentFragment}.
 */
exports.text2DOM = text2DOM, 
/** A function to sort strings. */
exports.stringSort = new Intl.Collator().compare, 
/**
 * This function prevents a updates from happening too often by limiting how often they can run.
 *
 * @param {number}  [timer=0]     Timeout in milliseconds before another update can run.
 * @param {boolean} [first=false] Flag to determine whether or not the first or last update function should be run.
 *
 * @return {(fn: Function) => void} A function which takes the update function that will be debounced.
 */
exports.debounce = debounce;
/**
 * This class provides a convenient way to extend a Function with class attributes and methods.
 *
 * The child class will need appropriate typing to make it correctly appear as the type of the passed function as well as the child class.
 */
var Callable = /** @class */ (function (_super) {
    __extends(Callable, _super);
    function Callable(fn) {
        var _newTarget = this.constructor;
        var _this = this;
        false && (_this = _super.call(this) || this);
        return Object.setPrototypeOf(fn, _newTarget.prototype);
    }
    return Callable;
}(Function));
exports.Callable = Callable;
;
