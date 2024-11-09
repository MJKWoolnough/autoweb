package main

import (
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"time"
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

	var sb strings.Builder

	_, err = io.Copy(&sb, f)
	f.Close()

	l, err := net.ListenTCP("tcp", &net.TCPAddr{
		IP:   net.IPv4(127, 0, 0, 1),
		Port: port,
	})
	if err != nil {
		return err
	}

	defer l.Close()

	var mux http.ServeMux

	mux.Handle("/", serveContents(indexHTML))
	mux.Handle("/auto.js", serveContents(codeJS))
	mux.Handle("/script.js", serveContents(sb.String()))

	server := http.Server{
		Handler: &mux,
	}

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