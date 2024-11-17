package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"time"

	"vimagination.zapto.org/javascript"
	"vimagination.zapto.org/parser"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)

		os.Exit(1)
	}
}

var now = time.Now()

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
		browser   Browser
		port      int
		script    string
		keepAlive bool
	)

	flag.Var(&browser, "b", "Specify the browser to launch. Either just a path or a JSON encoded array of the command parts.")
	flag.BoolVar(&keepAlive, "k", false, "don't exit when browser command returns")
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

	l, err := net.ListenTCP("tcp", &net.TCPAddr{
		IP:   net.IPv4(127, 0, 0, 1),
		Port: port,
	})
	if err != nil {
		return err
	}

	defer l.Close()

	server := newServer(fmt.Sprintf("%s", m))

	go http.Serve(l, server)

	c := make(chan os.Signal, 1)

	signal.Notify(c, os.Interrupt)
	defer signal.Reset(os.Interrupt)

	cmd := browser.Launch("http://" + l.Addr().String())
	if err := cmd.Start(); err != nil {
		return err
	}

	go func() {
		c <- <-c

		l.Close()
		cmd.Process.Signal(os.Interrupt)
	}()

	if keepAlive {
		c <- <-c
	}

	return cmd.Wait()
}
