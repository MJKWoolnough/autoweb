"use strict";
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
exports.WSConn = exports.WS = exports.HTTPRequest = void 0;
var inter_js_1 = require("./inter.js");
var once = { "once": true }, base = new URL(window.location + "");
var 
/**
 * In its simplest incarnation, this function takes a URL and returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} which will return the string response from that URL. However, the passed {@link Properties} object can modify both how the request is sent and the response interpreted.
 *
 * @typeParam T
 * @param {string}     url     The URL to request.
 * @param {Properties} [props] An optional object containing properties to modify the request.
 *
 * @return {Promise<T | string | XMLDocument | Blob | ArrayBuffer | XMLHttpRequest>} A promise resolving to a type that depends on the options passed.
 */
HTTPRequest = function (url, props) {
    if (props === void 0) { props = {}; }
    return new Promise(function (successFn, errorFn) {
        var _a, _b, _c, _d;
        var xh = new XMLHttpRequest();
        xh.open((_a = props["method"]) !== null && _a !== void 0 ? _a : "GET", url);
        if (props.hasOwnProperty("headers") && typeof props["headers"] === "object") {
            for (var _i = 0, _e = Object.entries(props["headers"]); _i < _e.length; _i++) {
                var _f = _e[_i], header = _f[0], value = _f[1];
                xh.setRequestHeader(header, value);
            }
        }
        if (props["type"] !== undefined) {
            xh.setRequestHeader("Content-Type", props["type"]);
        }
        if (props["user"] || props["password"]) {
            xh.setRequestHeader("Authorization", "Basic " + btoa("".concat((_b = props["user"]) !== null && _b !== void 0 ? _b : "", ":").concat((_c = props["password"]) !== null && _c !== void 0 ? _c : "")));
        }
        xh.addEventListener("readystatechange", function () {
            if (xh.readyState === 4) {
                if (xh.status >= 200 && xh.status < 300) {
                    if (props["response"] === "json" && props["checker"] && !props.checker(xh.response)) {
                        errorFn(new TypeError("received JSON does not match expected format"));
                    }
                    else {
                        successFn(props["response"] === "xh" ? xh : xh.response);
                    }
                }
                else {
                    errorFn(new Error(xh.response));
                }
            }
        });
        if (props["onuploadprogress"]) {
            xh.upload.addEventListener("progress", props["onuploadprogress"]);
        }
        if (props["ondownloadprogress"]) {
            xh.addEventListener("progress", props["ondownloadprogress"]);
        }
        switch (props["response"]) {
            case "text":
                xh.overrideMimeType("text/plain");
                break;
            case "xml":
                xh.overrideMimeType("text/xml");
                xh.responseType = "document";
                break;
            case "json":
                xh.overrideMimeType("application/json");
            case "document":
            case "blob":
            case "arraybuffer":
                xh.responseType = props["response"];
        }
        if (props["signal"]) {
            var signal_1 = props["signal"];
            signal_1.addEventListener("abort", function () {
                xh.abort();
                errorFn(signal_1.reason instanceof Error ? signal_1.reason : new Error(signal_1.reason));
            }, once);
        }
        xh.send((_d = props["data"]) !== null && _d !== void 0 ? _d : null);
    });
}, 
/**
 * This function takes a url and returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} which will resolve with an initiated {@link WSConn} on a successful connection.
 *
 * @param {string} url An absolute or relative URL to connect to.
 *
 * @returns {Promise<WSConn>} A Promise that resolves to a WSConn.
 */
WS = function (url) { return new Promise(function (successFn, errorFn) {
    var ws = new WSConn(url);
    ws.addEventListener("open", function () {
        ws.removeEventListener("error", errorFn);
        successFn(ws);
    }, once);
    ws.addEventListener("error", errorFn, once);
}); };
/**
 * In its simplest incarnation, this function takes a URL and returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} which will return the string response from that URL. However, the passed {@link Properties} object can modify both how the request is sent and the response interpreted.
 *
 * @typeParam T
 * @param {string}     url     The URL to request.
 * @param {Properties} [props] An optional object containing properties to modify the request.
 *
 * @return {Promise<T | string | XMLDocument | Blob | ArrayBuffer | XMLHttpRequest>} A promise resolving to a type that depends on the options passed.
 */
exports.HTTPRequest = HTTPRequest, 
/**
 * This function takes a url and returns a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} which will resolve with an initiated {@link WSConn} on a successful connection.
 *
 * @param {string} url An absolute or relative URL to connect to.
 *
 * @returns {Promise<WSConn>} A Promise that resolves to a WSConn.
 */
exports.WS = WS;
/**
 * WSConn extends the {@link https://developer.mozilla.org/en-US/docs/Web/API/WebSocket | WebSocket} class, allowing for the passed URL to be relative to the current URL.
 *
 * In addition, it adds the {@link WSConn/when} method.
 */
var WSConn = /** @class */ (function (_super) {
    __extends(WSConn, _super);
    /**
     * The constructor is nearly identical to usage of the parent class except that the url param need not be absolute.
     *
     * @param {string}            url         URL to connect to, can be absolute or relative.
     * @param {string | string[]} [protocols] Either a single, or array of, [sub-]protocols.
     */
    function WSConn(url, protocols) {
        return _super.call(this, new URL(url, base), protocols) || this;
    }
    /**
     * This method acts like the {@link module:inter/Subscription.when | when} method of the {@link inter:Subscription | Subscription} class from the {@link module:inter | inter} module, taking an optional success function, which will receive a MessageEvent object, and an optional error function, which will receive an error. The method returns a {@link inter/Subscription} object with the success and error functions set to those provided.
     *
     * @typeParam {any} T = Success type
     * @typeParam {any} U = Error type
     * @param {(data: MessageEvent) => T} [ssFn] Function to be called when a message arrives.
     * @param {(data: Error) => U}        [eeFn] Function to be called when an error occurs.
     *
     * @return {Subscription<T | Y>} A {@link inter:Subscription | Subscription} object.
     */
    WSConn.prototype.when = function (ssFn, eeFn) {
        var _this = this;
        return new inter_js_1.Subscription(function (sFn, eFn, cFn) {
            var w = _this, ac = new AbortController(), o = { "signal": ac.signal };
            w.addEventListener("message", sFn, o);
            w.addEventListener("error", function (e) { return eFn(e.error); }, o);
            w.addEventListener("close", function (e) {
                var err = new Error(e.reason);
                err.name = "CloseError";
                eFn(err);
                ac.abort();
            }, o);
            cFn(function () { return ac.abort(); });
        }).when(ssFn, eeFn);
    };
    return WSConn;
}(WebSocket));
exports.WSConn = WSConn;
base.protocol = base.protocol === "https" ? "wss" : "ws";
