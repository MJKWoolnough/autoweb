"use strict";
/**
 * The load module contains a single default export, a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} which is resolved when the page finished loading.
 * @module load
 */
/** */
Object.defineProperty(exports, "__esModule", { value: true });
/** This Promise successfully resolves when the page is loaded. */
exports.default = document.readyState === "complete" ? Promise.resolve() : new Promise(function (successFn) { return window.addEventListener("load", successFn, { "once": true }); });
