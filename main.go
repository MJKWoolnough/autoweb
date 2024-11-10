package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/javascript"
	"vimagination.zapto.org/jsonrpc"
	"vimagination.zapto.org/parser"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)

		os.Exit(1)
	}
}

var (
	//go:embed index.html
	indexHTML string

	//go:embed auto.js
	codeJS string

	now = time.Now()
)

type serveContents string

func (s serveContents) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	http.ServeContent(w, r, r.URL.Path, now, strings.NewReader(string(s)))
}

type Browser []string

func (b *Browser) Set(v string) error {
	if err := json.Unmarshal([]byte(v), b); err != nil {
		*b = []string{v}
	}

	return nil
}

func (Browser) String() string {
	return ""
}

func (b Browser) Launch(url string) *exec.Cmd {
	return exec.Command(b[0], append(b[1:], url)...)
}

func run() error {
	var (
		browser Browser
		port    int
		script  string
	)

	flag.Var(&browser, "b", "Specify the browser to launch. Either just a path or a JSON encoded array of the command parts.")
	flag.IntVar(&port, "p", 0, "Port for server to listen on.")
	flag.StringVar(&script, "s", "", "Script to run.")
	flag.Parse()

	f, err := os.Open(script)
	if err != nil {
		return err
	}

	tk := parser.NewReaderTokeniser(f)

	m, err := javascript.ParseModule(javascript.AsTypescript(&tk))
	if err != nil {
		return err
	}

	source := fmt.Sprintf("%s", m)

	l, err := net.ListenTCP("tcp", &net.TCPAddr{
		IP:   net.IPv4(127, 0, 0, 1),
		Port: port,
	})
	if err != nil {
		return err
	}

	defer l.Close()

	var mux http.ServeMux

	server := http.Server{
		Handler: &mux,
	}

	rpc := &rpc{
		server: &server,
	}

	mux.Handle("/", serveContents(indexHTML))
	mux.Handle("/auto.js", serveContents(codeJS))
	mux.Handle("/script.js", serveContents(source))
	mux.Handle("/socket", websocket.Handler(func(conn *websocket.Conn) {
		jsonrpc.New(conn, rpc).Handle()

		rpc.server = &server
	}))

	go server.Serve(l)

	c := make(chan os.Signal, 1)

	signal.Notify(c, os.Interrupt)
	defer signal.Reset(os.Interrupt)

	cmd := browser.Launch(fmt.Sprintf("http://%s", l.Addr()))
	if err := cmd.Start(); err != nil {
		return err
	}

	go func() {
		<-c

		l.Close()
		cmd.Process.Signal(os.Interrupt)
	}()

	return cmd.Wait()
}

type rpc struct {
	mu     sync.RWMutex
	server *http.Server
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

var ErrUnknownEndpoint = errors.New("unknown endpoint")
