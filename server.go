package main

import (
	_ "embed"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"

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
	s.mux.Handle("/socket", websocket.Handler(s.intiRPC))

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
