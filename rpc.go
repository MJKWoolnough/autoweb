package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
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

type HTTPResponse struct {
	Code    int
	Message string
}

type serveContents string

func (s serveContents) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	http.ServeContent(w, r, r.URL.Path, now, strings.NewReader(string(s)))
}

type wsconn struct {
	conn *websocket.Conn
	wg   sync.WaitGroup
}

type Server struct {
	handler http.Handler
	mux     http.ServeMux
	rproxy  atomic.Pointer[httputil.ReverseProxy]
	rpc     atomic.Pointer[jsonrpc.ClientServer]

	mu      sync.RWMutex
	hooks   map[string]struct{}
	wsHooks map[string]*wsconn
}

func newServer(source string) *Server {
	s := new(Server)

	s.mux.Handle("/", serveContents(indexHTML))
	s.mux.Handle("/auto.js", serveContents(codeJS))
	s.mux.Handle("/script.js", serveContents(source))
	s.mux.Handle("/socket", websocket.Handler(func(conn *websocket.Conn) {
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
	}))

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p := s.rproxy.Load()

	if p != nil {
		s.handleHooks(w, r, p)
	} else {
		s.mux.ServeHTTP(w, r)
	}
}

type hookRequest struct {
	URL     string      `json:"url"`
	Method  string      `json:"method"`
	Headers http.Header `json:"headers"`
	Body    string      `json:"body"`
}

type hookResponse struct {
	Code    int         `json:"code"`
	Headers http.Header `json:"headers"`
	Body    string      `json:"body"`
}

func (s *Server) handleHooks(w http.ResponseWriter, r *http.Request, p *httputil.ReverseProxy) {
	if wp := r.Header.Get("Sec-WebSocket-Protocol"); strings.HasPrefix(wp, "X-HOOK-WS:") {
		s.handleHookedWS(w, r, wp)

		return
	}

	hookURL := s.getHookURL(r)

	if hookURL != "" {
		if resp := s.handleHook(w, r, hookURL); resp != nil {
			w.WriteHeader(resp.Code)

			io.WriteString(w, resp.Message)

			return
		}
	}

	p.ServeHTTP(w, r)
}

func (s *Server) handleHookedWS(w http.ResponseWriter, r *http.Request, wp string) {
	prot := wp

	if pos := strings.IndexByte(wp, ','); pos > 0 {
		prot = wp[:pos]
		wp = strings.TrimSpace(wp[pos+1:])
	}

	websocket.Handler(func(conn *websocket.Conn) {
		var justWait bool

		s.mu.Lock()
		existing := s.wsHooks[prot]
		if existing == nil {
			existing = &wsconn{conn: conn}
			s.wsHooks[prot] = existing
			justWait = true
			existing.wg.Add(1)
		}
		s.mu.Unlock()

		if justWait {
			existing.wg.Wait()
		} else {
			go io.Copy(existing.conn, conn)
			io.Copy(conn, existing.conn)

			conn.Close()
			existing.conn.Close()
			existing.wg.Done()
		}
	}).ServeHTTP(w, r)
}

func (s *Server) getHookURL(r *http.Request) string {
	if u := r.Header.Get("X-HOOK"); u != "" {
		up, err := url.Parse(u)
		if err == nil {
			r.URL = up
		}
	}

	matches := [...]string{
		r.URL.String(),
		r.URL.RequestURI(),
		r.URL.Path + "?" + r.URL.Query().Encode(),
		r.URL.Path,
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, u := range matches {
		if _, ok := s.hooks[u]; ok {
			return u
		}
	}

	return ""
}

func (s *Server) handleHook(w http.ResponseWriter, r *http.Request, hookURL string) *HTTPResponse {
	rpc := s.rpc.Load()

	if rpc == nil {
		return &HTTPResponse{http.StatusInternalServerError, "invalid state"}
	}

	req, err := makeHookRequest(r)
	if err != nil {
		return err
	}

	resp := new(hookResponse)

	if err := rpc.RequestValue(hookURL, req, &resp); err != nil {
		return &HTTPResponse{http.StatusInternalServerError, err.Error()}
	}

	if resp != nil {
		for key, value := range resp.Headers {
			w.Header()[key] = value
		}

		return &HTTPResponse{resp.Code, resp.Body}
	}

	return nil
}

func makeHookRequest(r *http.Request) (hookRequest, *HTTPResponse) {
	req := hookRequest{
		URL:     r.URL.String(),
		Method:  r.Method,
		Headers: r.Header,
	}

	if r.Body != nil {
		var sb strings.Builder

		if r.ContentLength > 0 {
			sb.Grow(int(r.ContentLength))
		}

		_, err := io.Copy(&sb, r.Body)
		r.Body.Close()

		if err != nil {
			return req, &HTTPResponse{http.StatusBadRequest, err.Error()}
		}

		req.Body = sb.String()

		r.Body = io.NopCloser(strings.NewReader(req.Body))
	}

	return req, nil
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
