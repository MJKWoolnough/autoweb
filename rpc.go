package main

import (
	"encoding/json"
	"errors"
	"net/http/httputil"
	"net/url"

	"github.com/go-vgo/robotgo"
	"golang.org/x/net/websocket"
	"vimagination.zapto.org/jsonrpc"
)

func (s *Server) intiRPC(conn *websocket.Conn) {
	srv := jsonrpc.NewClientServer(conn, s)
	if s.rpc.CompareAndSwap(srv, nil) {
		srv.SendData(ErrSingleConnection)

		return
	}

	s.hooks = make(map[string]struct{})
	s.wsHooks = make(map[string]*wsconn)
	srv.Handle()
	s.rpc.Store(nil)
	s.rproxy.Store(nil)
}

func (s *Server) HandleRPC(method string, data json.RawMessage) (any, error) {
	switch method {
	case "getScreenSize":
		return s.getScreenSize()
	case "proxy":
		return handle(data, s.proxy)
	case "addHook":
		return handle(data, s.addHook)
	case "removeHook":
		return handle(data, s.addHook)
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

func (s *Server) addHook(path string) (any, error) {
	s.mu.Lock()
	s.hooks[path] = struct{}{}
	s.mu.Unlock()

	return nil, nil
}

func (s *Server) removeHook(path string) (any, error) {
	s.mu.Lock()
	delete(s.hooks, path)
	s.mu.Unlock()

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
	ErrSingleConnection   = json.RawMessage(`{"id":-999,"error":{"message":"only a single connection is allowed"}}`)
)
