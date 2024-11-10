package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"sync/atomic"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/jsonrpc"
)

type rpc struct {
	mu     sync.RWMutex
	server *http.Server
}

func rpcInit(server *http.Server) websocket.Handler {
	var singleConnection uint32

	rpc := &rpc{
		server: server,
	}

	return websocket.Handler(func(conn *websocket.Conn) {
		srv := jsonrpc.New(conn, rpc)
		if !atomic.CompareAndSwapUint32(&singleConnection, 0, 1) {
			srv.Send(ErrSingleConnection)

			return
		}

		srv.Handle()
		atomic.StoreUint32(&singleConnection, 0)

		rpc.server = server
	})
}

func (r *rpc) HandleRPC(method string, data json.RawMessage) (any, error) {
	switch method {
	case "proxy":
		return handle(data, r.proxy)
	}

	return nil, ErrUnknownEndpoint
}

func handle[T any](data json.RawMessage, fn func(data T) (any, error)) (any, error) {
	var v T

	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}

	return fn(v)
}

func (r *rpc) proxy(u string) (any, error) {
	rp, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	r.mu.Lock()
	r.server.Handler = httputil.NewSingleHostReverseProxy(rp)
	r.mu.Unlock()

	return nil, nil
}

var (
	ErrUnknownEndpoint  = errors.New("unknown endpoint")
	ErrSingleConnection = jsonrpc.Response{
		ID: -999,
		Error: &jsonrpc.Error{
			Message: "only a single connection is allowed",
		},
	}
)
