package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"sync/atomic"

	"github.com/go-vgo/robotgo"
	"golang.org/x/net/websocket"
	"vimagination.zapto.org/jsonrpc"
)

type Server struct {
	mu      sync.RWMutex
	handler http.Handler
	mux     http.ServeMux
	rproxy  *httputil.ReverseProxy
}

func newServer(source string) *Server {
	var mux http.ServeMux

	s := new(Server)

	mux.Handle("/", serveContents(indexHTML))
	mux.Handle("/auto.js", serveContents(codeJS))
	mux.Handle("/script.js", serveContents(source))

	var singleConnection uint32

	mux.Handle("/socket", websocket.Handler(func(conn *websocket.Conn) {
		srv := jsonrpc.New(conn, s)
		if !atomic.CompareAndSwapUint32(&singleConnection, 0, 1) {
			srv.Send(ErrSingleConnection)

			return
		}

		srv.Handle()
		atomic.StoreUint32(&singleConnection, 0)

		s.rproxy = nil
	}))

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var h http.Handler = &s.mux

	s.mu.RLock()
	p := s.rproxy
	s.mu.RUnlock()

	if p != nil {
		h = p
	}

	h.ServeHTTP(w, r)
}

func (s *Server) HandleRPC(method string, data json.RawMessage) (any, error) {
	switch method {
	case "proxy":
		return handle(data, s.proxy)
	case "getMouseCoords":
		return s.mouseCoords()
	case "moveMouse":
		return handle(data, s.moveMouse)
	case "clickMouse":
		return handle(data, s.clickMouse)
	case "dblClickMouse":
		return handle(data, s.dblClickMouse)
	case "mouseDown":
		return handle(data, s.mouseDown)
	case "mouseUp":
		return handle(data, s.mouseUp)
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

func (s *Server) proxy(u string) (any, error) {
	rp, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.rproxy = httputil.NewSingleHostReverseProxy(rp)
	s.mu.Unlock()

	return nil, nil
}

func (s *Server) mouseCoords() (any, error) {
	x, y := robotgo.Location()

	return [2]int{x, y}, nil
}

func (s *Server) moveMouse(mi [2]int) (any, error) {
	robotgo.Move(mi[0], mi[1])

	return nil, nil
}

func (s *Server) clickMouse(button string) (any, error) {
	if _, ok := robotgo.MouseMap[button]; !ok {
		return nil, ErrUnknownMouseButton
	}

	robotgo.Click(button)

	return nil, nil
}

func (s *Server) dblClickMouse(button string) (any, error) {
	if _, ok := robotgo.MouseMap[button]; !ok {
		return nil, ErrUnknownMouseButton
	}

	robotgo.Click(button, true)

	return nil, nil
}

func (s *Server) mouseDown(button string) (any, error) {
	if _, ok := robotgo.MouseMap[button]; !ok {
		return nil, ErrUnknownMouseButton
	}

	robotgo.MouseDown(button, true)

	return nil, nil
}

func (s *Server) mouseUp(button string) (any, error) {
	if _, ok := robotgo.MouseMap[button]; !ok {
		return nil, ErrUnknownMouseButton
	}

	robotgo.MouseUp(button, true)

	return nil, nil
}

var (
	ErrUnknownEndpoint    = errors.New("unknown endpoint")
	ErrUnknownMouseButton = errors.New("unknown mouse button")
	ErrSingleConnection   = jsonrpc.Response{
		ID: -999,
		Error: &jsonrpc.Error{
			Message: "only a single connection is allowed",
		},
	}
)
