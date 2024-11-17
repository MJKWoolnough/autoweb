package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync/atomic"

	"github.com/go-vgo/robotgo"
	"golang.org/x/net/websocket"
	"vimagination.zapto.org/jsonrpc"
)

var (
	//go:embed index.html
	indexHTML string

	//go:embed auto.js
	codeJS string
)

type serveContents string

func (s serveContents) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	http.ServeContent(w, r, r.URL.Path, now, strings.NewReader(string(s)))
}

type Server struct {
	handler http.Handler
	mux     http.ServeMux
	rproxy  atomic.Pointer[httputil.ReverseProxy]
	rpc     atomic.Pointer[jsonrpc.Server]
}

func newServer(source string) *Server {
	s := new(Server)

	s.mux.Handle("/", serveContents(indexHTML))
	s.mux.Handle("/auto.js", serveContents(codeJS))
	s.mux.Handle("/script.js", serveContents(source))
	s.mux.Handle("/socket", websocket.Handler(func(conn *websocket.Conn) {
		srv := jsonrpc.New(conn, s)
		if s.rpc.CompareAndSwap(srv, nil) {
			srv.Send(ErrSingleConnection)

			return
		}

		srv.Handle()
		s.rpc.Store(nil)
		s.rproxy.Store(nil)
	}))

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var h http.Handler = &s.mux

	p := s.rproxy.Load()

	if p != nil {
		h = p
	}

	h.ServeHTTP(w, r)
}

func (s *Server) HandleRPC(method string, data json.RawMessage) (any, error) {
	switch method {
	case "getScreenSize":
		return s.getScreenSize()
	case "proxy":
		return handle(data, s.proxy)
	case "getMouseCoords":
		return s.mouseCoords()
	case "jumpMouse":
		return handle(data, s.jumpMouse)
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
	case "keyPress":
		return handle(data, s.keyPress)
	case "keyDown":
		return handle(data, s.keyDown)
	case "keyUp":
		return handle(data, s.keyUp)
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

func (s *Server) getScreenSize() ([2]int, error) {
	x, y := robotgo.GetScreenSize()

	return [2]int{x, y}, nil
}

func (s *Server) proxy(u string) (any, error) {
	rp, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	s.rproxy.Store(httputil.NewSingleHostReverseProxy(rp))

	return nil, nil
}

func (s *Server) mouseCoords() (any, error) {
	x, y := robotgo.Location()

	return [2]int{x, y}, nil
}

func (s *Server) jumpMouse(mi [2]int) (any, error) {
	robotgo.Move(mi[0], mi[1])

	return nil, nil
}

func (s *Server) moveMouse(mi [2]int) (any, error) {
	robotgo.MoveSmooth(mi[0], mi[1])

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

	return nil, robotgo.MouseDown(button)
}

func (s *Server) mouseUp(button string) (any, error) {
	if _, ok := robotgo.MouseMap[button]; !ok {
		return nil, ErrUnknownMouseButton
	}

	return nil, robotgo.MouseUp(button)
}

func (s *Server) keyPress(key string) (any, error) {
	return nil, robotgo.KeyPress(key)
}

func (s *Server) keyDown(key string) (any, error) {
	return nil, robotgo.KeyDown(key)
}

func (s *Server) keyUp(key string) (any, error) {
	return nil, robotgo.KeyUp(key)
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
