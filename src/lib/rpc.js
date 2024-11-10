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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Queue_send, _RPC_instances, _RPC_c, _RPC_id, _RPC_r, _RPC_a, _RPC_sFn, _RPC_eFn, _RPC_connInit;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPC = exports.RPCError = void 0;
var inter_js_1 = require("./inter.js");
var noop = function () { }, noops = [noop, noop], newSet = function (m, id) {
    var s = new Set();
    m.set(id, s);
    return s;
}, makeHandler = function (sFn, eFn, typeCheck) { return [function (a) {
        try {
            if (!typeCheck || typeCheck(a)) {
                sFn(a);
            }
            else {
                eFn(new TypeError("invalid type"));
            }
        }
        catch (e) {
            eFn(e);
        }
    }, eFn]; };
/** This class is the error type for RPC, and contains a `code` number, `message` string, and a data field for any addition information of the error. */
var RPCError = /** @class */ (function () {
    function RPCError(code, message, data) {
        this.code = code;
        this.message = message;
        this.data = data;
        Object.freeze(this);
    }
    Object.defineProperty(RPCError.prototype, "name", {
        get: function () {
            return "RPCError";
        },
        enumerable: false,
        configurable: true
    });
    RPCError.prototype.toString = function () {
        return this.message;
    };
    return RPCError;
}());
exports.RPCError = RPCError;
var Queue = /** @class */ (function (_super) {
    __extends(Queue, _super);
    function Queue(send) {
        var _this = _super.call(this) || this;
        _Queue_send.set(_this, void 0);
        __classPrivateFieldSet(_this, _Queue_send, send, "f");
        return _this;
    }
    Queue.prototype.close = function () {
        for (var _i = 0, _a = this; _i < _a.length; _i++) {
            var msg = _a[_i];
            __classPrivateFieldGet(this, _Queue_send, "f").call(this, msg);
        }
    };
    Queue.prototype.send = function (data) {
        this.push(data);
    };
    Queue.prototype.when = function () { };
    return Queue;
}(Array));
_Queue_send = new WeakMap();
var RPC = /** @class */ (function () {
    /**
     * Creates an RPC object with a [Conn](#rpc_conn)
     *
     * @param {Conn} [conn] An interface that is used to do the network communication. If conn is not provided the requests will be queued until one is provided via reconnect.
     */
    function RPC(conn) {
        _RPC_instances.add(this);
        _RPC_c.set(this, void 0);
        _RPC_id.set(this, 0);
        _RPC_r.set(this, new Map());
        _RPC_a.set(this, new Map());
        _RPC_sFn.set(this, void 0);
        _RPC_eFn.set(this, void 0);
        __classPrivateFieldGet(this, _RPC_instances, "m", _RPC_connInit).call(this, conn);
    }
    /**
     * Reuses the RPC object with a new {@link Conn}.
     *
     * @param {Conn} conn An interface that is used to do the network communication.
     */
    RPC.prototype.reconnect = function (conn) {
        var c = __classPrivateFieldGet(this, _RPC_c, "f");
        __classPrivateFieldGet(this, _RPC_instances, "m", _RPC_connInit).call(this, conn);
        c === null || c === void 0 ? void 0 : c.close();
    };
    /**
     * The request method calls the remote procedure named by the `method` param, and sends any `params` data, JSON encoded, to it.
     *
     * The typeCheck function can be specified to check that the data returned matches the format expected.
     *
     * It is recommended to use a checker function, and the {@link module:typeguard} module can aid with that.
     *
     * @typeParam {any} T
     * @param {string}                                            method              The method name to be called.
     * @param {Exclude<any, Function> | ((a: unknown) => a is T)} [paramsOrTypeCheck] Either the params to be sent to the specified method, or a typecheck function.
     * @param {(a: unknown) => a is T}                            [typeCheck]         A typecheck function, if one was supplied to the second param.
     *
     * @return {Promise<T>} A Promise that will resolve with the returned data from the remote procedure call.
     */
    RPC.prototype.request = function (method, paramsOrTypeCheck, typeCheck) {
        var _this = this;
        var c = __classPrivateFieldGet(this, _RPC_c, "f");
        return c ? new Promise(function (sFn, eFn) {
            var _a, _b;
            typeCheck !== null && typeCheck !== void 0 ? typeCheck : (typeCheck = paramsOrTypeCheck instanceof Function ? paramsOrTypeCheck : undefined);
            var id = (__classPrivateFieldSet(_this, _RPC_id, (_b = __classPrivateFieldGet(_this, _RPC_id, "f"), _a = _b++, _b), "f"), _a);
            __classPrivateFieldGet(_this, _RPC_r, "f").set(id, makeHandler(sFn, eFn, typeCheck));
            c.send(JSON.stringify({
                id: id,
                method: method,
                "params": paramsOrTypeCheck instanceof Function ? undefined : paramsOrTypeCheck
            }));
        }) : Promise.reject("RPC Closed");
    };
    /**
     * The await method will wait for a message with a matching ID, which must be negative, and resolve the promise with the data that message contains.
     *
     * The typeCheck function can be specified to check that the data returned matches the format expected.
     *
     * It is recommended to use a checker function, and the {@link module:typeguard} module can aid with that.
     *
     * @param {number}                 id          The ID to wait for.
     * @param {(a: unknown) => a is T} [typeCheck] An optional typecheck function.
     *
     * @return {Promise<T>} A Promise that will resolve with the returned data.
     */
    RPC.prototype.await = function (id, typeCheck) {
        var _a;
        var h = [noop, noop], a = __classPrivateFieldGet(this, _RPC_a, "f"), s = (_a = a.get(id)) !== null && _a !== void 0 ? _a : newSet(a, id), p = new Promise(function (sFn, eFn) {
            var _a;
            _a = makeHandler(sFn, eFn, typeCheck), h[0] = _a[0], h[1] = _a[1];
            s.add(h);
        });
        p.finally(function () { return s.delete(h); }).catch(function () { });
        return p;
    };
    /**
     * The subscribe method will wait for a message with a matching ID, which must be negative, and resolve the {@link inter:Subscription} with the data that message contains for each message with that ID.
     *
     * The typeCheck function can be specified to check that the data returned matches the format expected.
     *
     * It is recommended to use a checker function, and the {@link module:typeguard} module can aid with that.
     *
     * @param {number}                 id          The ID to wait for.
     * @param {(a: unknown) => a is T} [typeCheck] An optional typecheck function.
     *
     * @return {Subscription<T>} A Subscription that will resolve whenever data is received.
     */
    RPC.prototype.subscribe = function (id, typeCheck) {
        var _this = this;
        return new inter_js_1.Subscription(function (sFn, eFn, cFn) {
            var _a;
            var h = makeHandler(sFn, eFn, typeCheck), a = __classPrivateFieldGet(_this, _RPC_a, "f"), s = (_a = a.get(id)) !== null && _a !== void 0 ? _a : newSet(a, id);
            s.add(h);
            cFn(function () { return s.delete(h); });
        });
    };
    /** Closes the RPC connection. */
    RPC.prototype.close = function () {
        var c = __classPrivateFieldGet(this, _RPC_c, "f");
        __classPrivateFieldSet(this, _RPC_c, null, "f");
        c === null || c === void 0 ? void 0 : c.close();
    };
    return RPC;
}());
exports.RPC = RPC;
_RPC_c = new WeakMap(), _RPC_id = new WeakMap(), _RPC_r = new WeakMap(), _RPC_a = new WeakMap(), _RPC_sFn = new WeakMap(), _RPC_eFn = new WeakMap(), _RPC_instances = new WeakSet(), _RPC_connInit = function _RPC_connInit(conn) {
    var _this = this;
    var _a, _b;
    (__classPrivateFieldSet(this, _RPC_c, conn !== null && conn !== void 0 ? conn : new Queue(function (msg) { var _a; return (_a = __classPrivateFieldGet(_this, _RPC_c, "f")) === null || _a === void 0 ? void 0 : _a.send(msg); }), "f")).when(__classPrivateFieldSet(this, _RPC_sFn, (_a = __classPrivateFieldGet(this, _RPC_sFn, "f")) !== null && _a !== void 0 ? _a : (function (_a) {
        var _b, _c;
        var data = _a.data;
        var message = JSON.parse(data), id = typeof message.id === "string" ? parseInt(message.id) : message.id, e = message.error, i = +!!e, m = e ? new RPCError(e.code, e.message, e.data) : message.result;
        if (id >= 0) {
            ((_b = __classPrivateFieldGet(_this, _RPC_r, "f").get(id)) !== null && _b !== void 0 ? _b : noops)[i](m);
            __classPrivateFieldGet(_this, _RPC_r, "f").delete(id);
        }
        else {
            for (var _i = 0, _d = (_c = __classPrivateFieldGet(_this, _RPC_a, "f").get(id)) !== null && _c !== void 0 ? _c : []; _i < _d.length; _i++) {
                var r = _d[_i];
                r[i](m);
            }
        }
    }), "f"), __classPrivateFieldSet(this, _RPC_eFn, (_b = __classPrivateFieldGet(this, _RPC_eFn, "f")) !== null && _b !== void 0 ? _b : (function (err) {
        _this.close();
        for (var _i = 0, _a = __classPrivateFieldGet(_this, _RPC_r, "f"); _i < _a.length; _i++) {
            var _b = _a[_i], r = _b[1];
            r[1](err);
        }
        for (var _c = 0, _d = __classPrivateFieldGet(_this, _RPC_a, "f"); _c < _d.length; _c++) {
            var _e = _d[_c], s = _e[1];
            for (var _f = 0, s_1 = s; _f < s_1.length; _f++) {
                var r = s_1[_f];
                r[1](err);
            }
        }
    }), "f"));
};
