"use strict";
/**
 * The inter module provides classes to aid with communication between otherwise unrelated modules.
 *
 * @module inter
 */
/** */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Pipe_out, _Requester_responder, _Subscription_success, _Subscription_error, _Subscription_cancel, _Subscription_cancelBind, _WaitGroup_instances, _WaitGroup_waits, _WaitGroup_done, _WaitGroup_errors, _WaitGroup_update, _WaitGroup_complete, _WaitGroup_updateWG, _Pickup_data;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pickup = exports.WaitGroup = exports.Subscription = exports.Requester = exports.Pipe = void 0;
var isPipeWithDefault = function (v) { return v instanceof Array && v.length === 2 && v[0] instanceof Pipe; }, isSubscriptionWithDefault = function (v) { return v instanceof Array && v.length === 2 && v[0] instanceof Subscription; };
/**
 * The Pipe Class is used to pass values to multiple registered functions.
 */
var Pipe = /** @class */ (function () {
    function Pipe() {
        _Pipe_out.set(this, []);
    }
    Object.defineProperty(Pipe.prototype, "length", {
        /** The field contains the number of functions currently registered on the Pipe. */
        get: function () { return __classPrivateFieldGet(this, _Pipe_out, "f").length; },
        enumerable: false,
        configurable: true
    });
    /**
     * This function sends the data passed to any functions registered on the Pipe.
     *
     * Exceptions thrown be any receivers are ignored.
     *
     * @param {T} data The data to be sent.
     */
    Pipe.prototype.send = function (data) {
        for (var _i = 0, _a = __classPrivateFieldGet(this, _Pipe_out, "f"); _i < _a.length; _i++) {
            var fn = _a[_i];
            try {
                fn(data);
            }
            finally { }
        }
    };
    /**
     * The passed function will be registered on the Pipe and will receive any future values sent along it.
     *
     * NB: The same function can be set multiple times, and will be for each time it is set.
     *
     * @param {(data: T) => void} fn The Function to be registered.
     */
    Pipe.prototype.receive = function (fn) {
        __classPrivateFieldGet(this, _Pipe_out, "f").push(fn);
    };
    /**
     * The passed function will be unregistered from the Pipe and will no longer receive values sent along it.
     *
     * NB: If the function is registered multiple times, only a single entry will be unregistered.
     *
     * @param {(data: T) => void} fn The Function to be removed.
     *
     * @return {boolean} Returns true when a function is unregistered, false otherwise.
     */
    Pipe.prototype.remove = function (fn) {
        for (var _i = 0, _a = __classPrivateFieldGet(this, _Pipe_out, "f").entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], afn = _b[1];
            if (afn === fn) {
                __classPrivateFieldGet(this, _Pipe_out, "f").splice(i, 1);
                return true;
            }
        }
        return false;
    };
    Pipe.prototype.bind = function (bindmask) {
        var _this = this;
        if (bindmask === void 0) { bindmask = 7; }
        return [bindmask & 1 ? function (data) { return _this.send(data); } : undefined, bindmask & 2 ? function (fn) { return _this.receive(fn); } : undefined, bindmask & 4 ? function (fn) { return _this.remove(fn); } : undefined];
    };
    /**
     * This method calls the passed function with the values retrieved from the passed pipes and values.
     *
     * @param {Function}                      cb    The function that will be called with the values from all of the pipes.
     * @param {...(Pipe | [Pipe, any] | any)} pipes The pipes or values to combine and pass to the callback function. A Pipe can be combined with an initial value in a tuple.
     *
     * @return {Function} Cancel function to stop the pipes being merged.
     */
    Pipe.any = function (cb) {
        var pipes = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            pipes[_i - 1] = arguments[_i];
        }
        var debounce = false;
        var defs = pipes.map(function (p) { return p instanceof Pipe ? undefined : isPipeWithDefault(p) ? p[1] : p; }), cancels = [];
        var _loop_1 = function (n, p) {
            if (p instanceof Pipe || isPipeWithDefault(p)) {
                var pipe_1 = (p instanceof Array ? p[0] : p), fn_1 = function (v) {
                    defs[n] = v;
                    if (!debounce) {
                        debounce = true;
                        queueMicrotask(function () {
                            cb(defs);
                            debounce = false;
                        });
                    }
                };
                pipe_1.receive(fn_1);
                cancels.push(function () { return pipe_1.remove(fn_1); });
            }
        };
        for (var _a = 0, _b = pipes.entries(); _a < _b.length; _a++) {
            var _c = _b[_a], n = _c[0], p = _c[1];
            _loop_1(n, p);
        }
        return function () {
            for (var _i = 0, cancels_1 = cancels; _i < cancels_1.length; _i++) {
                var fn = cancels_1[_i];
                fn();
            }
        };
    };
    return Pipe;
}());
exports.Pipe = Pipe;
_Pipe_out = new WeakMap();
/** The Requester Class is used to allow a server to set a function or value for multiple clients to query. */
var Requester = /** @class */ (function () {
    function Requester() {
        _Requester_responder.set(this, void 0);
    }
    /**
     * The request method sends data to a set responder and receives a response. Will throw an error if no responder is set.
     *
     * @param {...U} data The data to be sent to the responder.
     *
     * @return {T} The data returned from the responder.
     */
    Requester.prototype.request = function () {
        var data = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            data[_i] = arguments[_i];
        }
        var r = __classPrivateFieldGet(this, _Requester_responder, "f");
        if (r === undefined) {
            throw new Error("no responder set");
        }
        else if (r instanceof Function) {
            return r.apply(void 0, data);
        }
        return r;
    };
    /*
     * The responder method sets either the function that will respond to any request, or the value that will be the response to any request.
     *
     * @param {((...data: U) => T) | T} f The data that will be returned, or the Function that will deal with the request and return data.
     */
    Requester.prototype.responder = function (f) {
        __classPrivateFieldSet(this, _Requester_responder, f, "f");
    };
    return Requester;
}());
exports.Requester = Requester;
_Requester_responder = new WeakMap();
/**
 * The Subscription Class is similar to the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} class, but any success and error functions can be called multiple times.
 */
var Subscription = /** @class */ (function () {
    /**
     * The constructor of the Subscription class takes a function that receives success, error, and cancel functions.
     *
     * The success function can be called multiple times and will send any params in the call on to any 'when' functions.
     *
     * The error function can be called multiple times and will send any params in the call on to any 'catch' functions.
     *
     * The cancel function can be called at any time with a function to deal with any cancel signals generated by this Subscription object, or any child Subscription objects.
     *
     * @param {(successFn: (data: T) => void, errorFn: (data: any) => void, cancelFn: (data: () => void) => void) => void} fn The Function that receives the success, error, and cancel Functions.
     */
    function Subscription(fn) {
        var _this = this;
        _Subscription_success.set(this, void 0);
        _Subscription_error.set(this, void 0);
        _Subscription_cancel.set(this, void 0);
        _Subscription_cancelBind.set(this, void 0);
        var _a = new Pipe().bind(3), successSend = _a[0], successReceive = _a[1], errPipe = new Pipe(), _b = errPipe.bind(2), errorReceive = _b[1];
        fn(successSend, function (err) {
            if (errPipe.length) {
                errPipe.send(err);
            }
            else {
                throw err;
            }
        }, function (fn) { return __classPrivateFieldSet(_this, _Subscription_cancel, fn, "f"); });
        __classPrivateFieldSet(this, _Subscription_success, successReceive, "f");
        __classPrivateFieldSet(this, _Subscription_error, errorReceive, "f");
    }
    /**
     * This  method act similarly to the then method of the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} class, except that it can be activated multiple times.
     *
     * @param {((data: T) => TResult1) | null}   [successFn] The Function to be called on a success.
     * @param {((data: any) => TResult2) | null} [errorFn]   The Function to be called on an error.
     *
     * @return {Subscription} A new Subscription that continues the Subscription chain.
     */
    Subscription.prototype.when = function (successFn, errorFn) {
        var _this = this;
        var _a;
        var s = new Subscription(function (sFn, eFn) {
            __classPrivateFieldGet(_this, _Subscription_success, "f").call(_this, successFn instanceof Function ? function (data) {
                try {
                    sFn(successFn(data));
                }
                catch (e) {
                    eFn(e);
                }
            } : sFn);
            __classPrivateFieldGet(_this, _Subscription_error, "f").call(_this, errorFn instanceof Function ? function (data) {
                try {
                    sFn(errorFn(data));
                }
                catch (e) {
                    eFn(e);
                }
            } : eFn);
        });
        __classPrivateFieldSet(s, _Subscription_cancelBind, __classPrivateFieldSet(s, _Subscription_cancel, __classPrivateFieldSet(this, _Subscription_cancelBind, (_a = __classPrivateFieldGet(this, _Subscription_cancelBind, "f")) !== null && _a !== void 0 ? _a : (function () { var _a; return (_a = __classPrivateFieldGet(_this, _Subscription_cancel, "f")) === null || _a === void 0 ? void 0 : _a.call(_this); }), "f"), "f"), "f");
        return s;
    };
    /** This method sends a signal up the Subscription chain to the cancel function set during the construction of the original Subscription. */
    Subscription.prototype.cancel = function () {
        var _a;
        (_a = __classPrivateFieldGet(this, _Subscription_cancel, "f")) === null || _a === void 0 ? void 0 : _a.call(this);
    };
    /**
     * The catch method act similarly to the catch method of the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} class, except that it can be activated multiple times.
     *
     * @param {(data: any) => TResult} errorFn A Function to be called when the Subscription throws an error.
     *
     * @return {Subscription} A new Subscription that can respond to the output of the supplied Function.
     */
    Subscription.prototype.catch = function (errorFn) {
        return this.when(undefined, errorFn);
    };
    /**
     * The finally method act similarly to the finally method of the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | Promise} class, except that it can be activated multiple times.
     *
     * @param {() => void} afterFn A Function that will be called whenever this Subscription is activated.
     *
     * @return {Subscription} A new Subscription that responds to the output of the parent Subscription Object.
     */
    Subscription.prototype.finally = function (afterFn) {
        return this.when(function (data) { return (afterFn(), data); }, function (error) {
            afterFn();
            throw error;
        });
    };
    /**
     * This method creates a break in the cancel signal chain, so that any cancel signal simply removes that Subscription from it's parent.
     *
     * @param {boolean} [cancelOnEmpty] When true, will send an actual cancel signal all the way up the chain when called on the last split child.
     *
     * @return {() => Subscription} A Function that returns a new Subscription with the cancel signal intercepted.
     */
    Subscription.prototype.splitCancel = function (cancelOnEmpty) {
        var _this = this;
        if (cancelOnEmpty === void 0) { cancelOnEmpty = false; }
        var _a = new Pipe().bind(), successSend = _a[0], successReceive = _a[1], successRemove = _a[2], _b = new Pipe().bind(), errorSend = _b[0], errorReceive = _b[1], errorRemove = _b[2];
        var n = 0;
        this.when(successSend, errorSend);
        return function () { return new Subscription(function (sFn, eFn, cancelFn) {
            n++;
            successReceive(sFn);
            errorReceive(eFn);
            cancelFn(function () {
                successRemove(sFn);
                errorRemove(eFn);
                cancelFn(function () { });
                if (!--n && cancelOnEmpty) {
                    _this.cancel();
                }
            });
        }); };
    };
    /**
     * The merge static method combines any number of Subscription objects into a single subscription, so that all parent success and catch calls are combined, and any cancel signal will be sent to all parents.
     *
     * @param {...SubscriptionType} subs The Subscriptions to be merged.
     *
     * @return {Subscription} The merged Subscription Object.
     */
    Subscription.merge = function () {
        var subs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            subs[_i] = arguments[_i];
        }
        return new Subscription(function (success, error, cancel) {
            for (var _i = 0, subs_1 = subs; _i < subs_1.length; _i++) {
                var s = subs_1[_i];
                s.when(success, error);
            }
            cancel(function () {
                for (var _i = 0, subs_2 = subs; _i < subs_2.length; _i++) {
                    var s = subs_2[_i];
                    s.cancel();
                }
            });
        });
    };
    /**
     *
     * This method combines the passed in Subscriptions into a single Subscription that fires whenever any of the passed Subscriptions do. The data passed to the success function is an array of the latest value from each of the Subscriptions.
     *
     * Initial data for a Subscription can be set by putting the Subscription in a tuple with the default value as the second element (SubscriptionWithDefault).
     *
     * If no default is specified, the default is undefined.
     *
     * NB: The combined Subscription will fire in the next event loop, in order to collect all simultaneous changes.
     *
     * @param {...(SubscriptionType | [SubscriptionType, any])} subs The subscriptions to be merged, and with an option default type in a tuple.
     *
     * @return {Subscription} The combined Subscription that will fire when any of the passed subscriptions fire.
     */
    Subscription.any = function () {
        var subs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            subs[_i] = arguments[_i];
        }
        var debounce = false;
        var _a = Subscription.bind(), s = _a[0], sFn = _a[1], eFn = _a[2], cFn = _a[3], defs = subs.map(function (s) { return s instanceof Subscription ? undefined : isSubscriptionWithDefault(s) ? s[1] : s; });
        var _loop_2 = function (n, s_1) {
            if (s_1 instanceof Subscription || isSubscriptionWithDefault(s_1)) {
                (s_1 instanceof Array ? s_1[0] : s_1).when(function (v) {
                    defs[n] = v;
                    if (!debounce) {
                        debounce = true;
                        queueMicrotask(function () {
                            sFn(defs);
                            debounce = false;
                        });
                    }
                }, eFn);
            }
        };
        for (var _b = 0, _c = subs.entries(); _b < _c.length; _b++) {
            var _d = _c[_b], n = _d[0], s_1 = _d[1];
            _loop_2(n, s_1);
        }
        cFn(function () {
            for (var _i = 0, subs_3 = subs; _i < subs_3.length; _i++) {
                var s_2 = subs_3[_i];
                if (s_2 instanceof Subscription || isSubscriptionWithDefault(s_2)) {
                    (s_2 instanceof Array ? s_2[0] : s_2).cancel();
                }
            }
        });
        return s;
    };
    Subscription.bind = function (bindmask) {
        if (bindmask === void 0) { bindmask = 7; }
        var successFn, errorFn, cancelFn;
        var s = new Subscription(function (sFn, eFn, cFn) {
            successFn = sFn;
            errorFn = eFn;
            cancelFn = cFn;
        });
        return [s, bindmask & 1 ? successFn : undefined, bindmask & 2 ? errorFn : undefined, bindmask & 4 ? cancelFn : undefined];
    };
    return Subscription;
}());
exports.Subscription = Subscription;
_Subscription_success = new WeakMap(), _Subscription_error = new WeakMap(), _Subscription_cancel = new WeakMap(), _Subscription_cancelBind = new WeakMap();
/** The WaitGroup Class is used to wait for multiple asynchronous tasks to complete. */
var WaitGroup = /** @class */ (function () {
    function WaitGroup() {
        _WaitGroup_instances.add(this);
        _WaitGroup_waits.set(this, 0);
        _WaitGroup_done.set(this, 0);
        _WaitGroup_errors.set(this, 0);
        _WaitGroup_update.set(this, new Pipe());
        _WaitGroup_complete.set(this, new Pipe());
    }
    /** This method adds to the number of registered tasks. */
    WaitGroup.prototype.add = function () {
        var _a;
        __classPrivateFieldSet(this, _WaitGroup_waits, (_a = __classPrivateFieldGet(this, _WaitGroup_waits, "f"), _a++, _a), "f");
        __classPrivateFieldGet(this, _WaitGroup_instances, "m", _WaitGroup_updateWG).call(this);
    };
    /** This method adds to the number of complete tasks. */
    WaitGroup.prototype.done = function () {
        var _a;
        __classPrivateFieldSet(this, _WaitGroup_done, (_a = __classPrivateFieldGet(this, _WaitGroup_done, "f"), _a++, _a), "f");
        __classPrivateFieldGet(this, _WaitGroup_instances, "m", _WaitGroup_updateWG).call(this);
    };
    /** This method adds to the number of failed tasks. */
    WaitGroup.prototype.error = function () {
        var _a;
        __classPrivateFieldSet(this, _WaitGroup_errors, (_a = __classPrivateFieldGet(this, _WaitGroup_errors, "f"), _a++, _a), "f");
        __classPrivateFieldGet(this, _WaitGroup_instances, "m", _WaitGroup_updateWG).call(this);
    };
    /**
     * This method registers a function to run whenever a task is added, completed, or failed.
     *
     * @param {(wi: WaitInfo) => void} fn The Function to call when any tasks are added, complete, or fail.
     *
     * @return {() => void} A function to deregister the supplied function.
     */
    WaitGroup.prototype.onUpdate = function (fn) {
        var _this = this;
        __classPrivateFieldGet(this, _WaitGroup_update, "f").receive(fn);
        return function () { return __classPrivateFieldGet(_this, _WaitGroup_update, "f").remove(fn); };
    };
    /**
     * This method registers a function to run when all registered tasks are complete, successfully or otherwise.
     *
     * @param {(wi: WaitInfo) => void} fn The Function to call when all tasks are finished.
     *
     * @return {() => void} A function to deregister the supplied function.
     */
    WaitGroup.prototype.onComplete = function (fn) {
        var _this = this;
        __classPrivateFieldGet(this, _WaitGroup_complete, "f").receive(fn);
        return function () { return __classPrivateFieldGet(_this, _WaitGroup_complete, "f").remove(fn); };
    };
    return WaitGroup;
}());
exports.WaitGroup = WaitGroup;
_WaitGroup_waits = new WeakMap(), _WaitGroup_done = new WeakMap(), _WaitGroup_errors = new WeakMap(), _WaitGroup_update = new WeakMap(), _WaitGroup_complete = new WeakMap(), _WaitGroup_instances = new WeakSet(), _WaitGroup_updateWG = function _WaitGroup_updateWG() {
    var data = {
        "waits": __classPrivateFieldGet(this, _WaitGroup_waits, "f"),
        "done": __classPrivateFieldGet(this, _WaitGroup_done, "f"),
        "errors": __classPrivateFieldGet(this, _WaitGroup_errors, "f")
    };
    __classPrivateFieldGet(this, _WaitGroup_update, "f").send(data);
    if (__classPrivateFieldGet(this, _WaitGroup_done, "f") + __classPrivateFieldGet(this, _WaitGroup_errors, "f") === __classPrivateFieldGet(this, _WaitGroup_waits, "f")) {
        __classPrivateFieldGet(this, _WaitGroup_complete, "f").send(data);
    }
};
/** The Pickup Class is used to pass a single value to a single recipient. */
var Pickup = /** @class */ (function () {
    function Pickup() {
        _Pickup_data.set(this, void 0);
    }
    /**
     * Used to set the value on the class.
     *
     * @param {T} d The data to set.
     *
     * @return {T} The data.
     */
    Pickup.prototype.set = function (d) {
        return __classPrivateFieldSet(this, _Pickup_data, d, "f");
    };
    /*
     * Used to retrieve the value if one has been set. It will return `undefined` if no value is currently set.
     *
     * Clears the data when it returns any.
     *
     * @returns {T | undefined}
     */
    Pickup.prototype.get = function () {
        var d = __classPrivateFieldGet(this, _Pickup_data, "f");
        __classPrivateFieldSet(this, _Pickup_data, undefined, "f");
        return d;
    };
    return Pickup;
}());
exports.Pickup = Pickup;
_Pickup_data = new WeakMap();
