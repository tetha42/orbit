package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	maxGuardBodyBytes = 1 << 20 // 1 MiB strict request quota
	maxConcurrentFim  = 2
)

type Server struct {
	fim         *FimEngine
	telemetry   *TelemetryCollector
	rootDir     string
	socketPath  string
	scanMu      sync.Mutex
	activeScans int
}

func NewGuardServer(rootDir, baselineDir, socketPath string) *Server {
	return &Server{
		fim:        NewFimEngine(rootDir, baselineDir),
		telemetry:  NewTelemetryCollector(),
		rootDir:    rootDir,
		socketPath: socketPath,
	}
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		expectedToken := strings.TrimSpace(os.Getenv("SECURITY_GUARD_TOKEN"))
		if expectedToken != "" {
			authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
			const prefix = "Bearer "
			var candidate string
			if len(authHeader) > len(prefix) && strings.EqualFold(authHeader[:len(prefix)], prefix) {
				candidate = strings.TrimSpace(authHeader[len(prefix):])
			}
			if len(candidate) != len(expectedToken) || subtle.ConstantTimeCompare([]byte(candidate), []byte(expectedToken)) != 1 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized security-guard request"})
				return
			}
		}
		next(w, r)
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/fim/status", s.requireAuth(s.handleFimStatus))
	mux.HandleFunc("POST /api/fim/scan", s.requireAuth(s.handleFimScan))
	mux.HandleFunc("POST /api/waf/inspect", s.requireAuth(s.handleWafInspect))
	mux.HandleFunc("GET /api/telemetry", s.requireAuth(s.handleTelemetry))
	return mux
}

func resolveSocketPath() string {
	if strings.EqualFold(os.Getenv("SECURITY_GUARD_DISABLE_SOCKET"), "1") {
		return ""
	}
	if p := strings.TrimSpace(os.Getenv("ORBIT_GUARD_SOCKET")); p != "" {
		if strings.EqualFold(p, "none") || strings.EqualFold(p, "off") {
			return ""
		}
		return p
	}
	if p := strings.TrimSpace(os.Getenv("SECURITY_GUARD_SOCKET")); p != "" {
		if strings.EqualFold(p, "none") || strings.EqualFold(p, "off") {
			return ""
		}
		return p
	}
	return filepath.Join(os.TempDir(), "orbit-security-guard.sock")
}

func listenUnixSocket(socketPath string) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(socketPath), 0o700); err != nil {
		return nil, err
	}
	// Only remove a stale socket if nothing is actively listening on it.
	if _, err := os.Stat(socketPath); err == nil {
		conn, dialErr := net.DialTimeout("unix", socketPath, 200*time.Millisecond)
		if dialErr == nil {
			_ = conn.Close()
			return nil, errors.New("unix socket already in active use: " + socketPath)
		}
		_ = os.Remove(socketPath)
	}
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(socketPath, 0o600); err != nil {
		_ = ln.Close()
		_ = os.Remove(socketPath)
		return nil, err
	}
	return ln, nil
}

func newHardenedHTTPServer(handler http.Handler) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	rootDir := os.Getenv("ORBIT_ROOT")
	if rootDir == "" {
		rootDir = "."
	}
	if absRoot, err := filepath.Abs(rootDir); err == nil {
		rootDir = absRoot
	}

	baselineDir := os.Getenv("ORBIT_FIM_BASELINE_DIR")
	if baselineDir == "" {
		baselineDir = filepath.Join(rootDir, "tools", "fim")
	} else if absBase, err := filepath.Abs(baselineDir); err == nil {
		baselineDir = absBase
	}

	socketPath := resolveSocketPath()
	srv := NewGuardServer(rootDir, baselineDir, socketPath)
	handler := srv.Handler()

	tcpServer := newHardenedHTTPServer(handler)
	tcpServer.Addr = ":" + port

	var unixLn net.Listener
	var unixServer *http.Server
	if socketPath != "" {
		ln, err := listenUnixSocket(socketPath)
		if err != nil {
			log.Printf("[SECURITY-GUARD] Warning: Unix IPC socket unavailable (%v)", err)
		} else {
			unixLn = ln
			unixServer = newHardenedHTTPServer(handler)
			go func() {
				log.Printf("[SECURITY-GUARD] Unix domain socket IPC listening at %s (mode 0600)", socketPath)
				if err := unixServer.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
					log.Printf("[SECURITY-GUARD] Unix IPC server error: %v", err)
				}
			}()
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tcpServer.Shutdown(shutdownCtx)
		if unixServer != nil {
			_ = unixServer.Shutdown(shutdownCtx)
		}
		if unixLn != nil {
			_ = os.Remove(socketPath)
		}
	}()

	log.Printf("[SECURITY-GUARD] Microservice starting on :%s (root: %s, baselines: %s)", port, rootDir, baselineDir)
	if err := tcpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("[SECURITY-GUARD] Fatal server error: %v", err)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	transports := []string{"tcp"}
	if s.socketPath != "" {
		transports = append([]string{"unix"}, transports...)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":            "ok",
		"service":           "security-guard",
		"version":           "1.2.0",
		"uptime":            s.telemetry.GetMetrics().UptimeSeconds,
		"transports":        transports,
		"socketPath":        s.socketPath,
		"fimConcurrencyMax": maxConcurrentFim,
	})
}

func (s *Server) handleFimStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	last := s.fim.GetLastResult()
	if last == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "idle",
			"result": nil,
		})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status": "ready",
		"result": last,
	})
}

func (s *Server) handleFimScan(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	s.scanMu.Lock()
	if s.activeScans >= maxConcurrentFim {
		s.scanMu.Unlock()
		w.Header().Set("Retry-After", "2")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "FIM scan concurrency quota saturated; retry shortly",
		})
		return
	}
	s.activeScans++
	s.scanMu.Unlock()
	defer func() {
		s.scanMu.Lock()
		s.activeScans--
		s.scanMu.Unlock()
	}()

	r.Body = http.MaxBytesReader(w, r.Body, maxGuardBodyBytes)
	var req struct {
		TargetDir    string `json:"targetDir"`
		SaveBaseline bool   `json:"saveBaseline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Request body exceeds 1 MiB quota"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON payload"})
		return
	}

	scope, target, err := ResolveTargetDir(s.rootDir, req.TargetDir)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	s.telemetry.IncrFimScan()
	res, err := s.fim.ScanWithScope(scope, target, req.SaveBaseline)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(res)
}

func (s *Server) handleWafInspect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	r.Body = http.MaxBytesReader(w, r.Body, maxGuardBodyBytes)
	var req struct {
		Pathname  string `json:"pathname"`
		Search    string `json:"search"`
		UserAgent string `json:"userAgent"`
		Referer   string `json:"referer"`
		Body      string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Request body exceeds 1 MiB quota"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON payload"})
		return
	}

	res := InspectPayload(req.Pathname, req.Search, req.UserAgent, req.Referer, req.Body)
	s.telemetry.IncrWafInspect(res.Matched)

	_ = json.NewEncoder(w).Encode(res)
}

func (s *Server) handleTelemetry(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(s.telemetry.GetMetrics())
}
