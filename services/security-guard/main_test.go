package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestUnixDomainSocketIPCAndPermissions(t *testing.T) {
	root := t.TempDir()
	baselineDir := t.TempDir()
	sockPath := filepath.Join(t.TempDir(), "guard.sock")

	if err := os.WriteFile(filepath.Join(root, "app.ts"), []byte("export const a = 1;\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	ln, err := listenUnixSocket(sockPath)
	if err != nil {
		t.Fatalf("failed to bind unix socket: %v", err)
	}
	defer func() {
		_ = ln.Close()
		_ = os.Remove(sockPath)
	}()

	info, err := os.Stat(sockPath)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("expected 0600 permissions on unix socket, got %o", perm)
	}

	srv := NewGuardServer(root, baselineDir, sockPath)
	httpSrv := newHardenedHTTPServer(srv.Handler())
	go func() { _ = httpSrv.Serve(ln) }()
	defer func() { _ = httpSrv.Shutdown(context.Background()) }()

	client := &http.Client{
		Timeout: 2 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", sockPath)
			},
		},
	}

	// 1. Health over Unix IPC
	resp, err := client.Get("http://unix/health")
	if err != nil {
		t.Fatalf("health IPC failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 over Unix socket, got %d", resp.StatusCode)
	}
	var health map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		t.Fatal(err)
	}
	if health["status"] != "ok" || health["socketPath"] != sockPath {
		t.Fatalf("unexpected health response: %+v", health)
	}

	// 2. WAF inspection over Unix IPC
	wafBody, _ := json.Marshal(map[string]string{
		"pathname": "/api/items",
		"search":   "?id=1%20UNION%20SELECT%20password%20FROM%20information_schema.tables",
	})
	wafResp, err := client.Post("http://unix/api/waf/inspect", "application/json", bytes.NewReader(wafBody))
	if err != nil {
		t.Fatalf("waf IPC failed: %v", err)
	}
	defer wafResp.Body.Close()
	var wafRes WafInspectionResult
	if err := json.NewDecoder(wafResp.Body).Decode(&wafRes); err != nil {
		t.Fatal(err)
	}
	if !wafRes.Matched || wafRes.Category != "sqli" {
		t.Fatalf("expected sqli match over Unix socket, got %+v", wafRes)
	}

	// 3. FIM scan over Unix IPC
	fimBody, _ := json.Marshal(map[string]any{"targetDir": "repo", "saveBaseline": true})
	fimResp, err := client.Post("http://unix/api/fim/scan", "application/json", bytes.NewReader(fimBody))
	if err != nil {
		t.Fatalf("fim IPC failed: %v", err)
	}
	defer fimResp.Body.Close()
	var fimRes FimScanResult
	if err := json.NewDecoder(fimResp.Body).Decode(&fimRes); err != nil {
		t.Fatal(err)
	}
	if !fimRes.BaselineSaved || fimRes.ScannedFiles != 1 {
		t.Fatalf("expected 1 scanned file and saved baseline over Unix socket, got %+v", fimRes)
	}
}

func TestRequestBodyQuotaAndFimConcurrencyLimit(t *testing.T) {
	srv := NewGuardServer(t.TempDir(), t.TempDir(), "")
	handler := srv.Handler()

	// Oversized WAF body (> 1 MiB) must be rejected with 413 Request Entity Too Large
	giant := `{"pathname":"/x","body":"` + strings.Repeat("A", maxGuardBodyBytes+128) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/waf/inspect", strings.NewReader(giant))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for oversized body, got %d", rec.Code)
	}

	// Saturate all maxConcurrentFim slots and verify 429 Too Many Requests + Retry-After
	srv.scanMu.Lock()
	srv.activeScans = maxConcurrentFim
	srv.scanMu.Unlock()
	defer func() {
		srv.scanMu.Lock()
		srv.activeScans = 0
		srv.scanMu.Unlock()
	}()

	var wg sync.WaitGroup
	wg.Add(1)
	var status int
	var retryAfter string
	go func() {
		defer wg.Done()
		fimReq := httptest.NewRequest(http.MethodPost, "/api/fim/scan", strings.NewReader(`{"targetDir":"repo"}`))
		fimRec := httptest.NewRecorder()
		handler.ServeHTTP(fimRec, fimReq)
		status = fimRec.Code
		retryAfter = fimRec.Header().Get("Retry-After")
	}()
	wg.Wait()

	if status != http.StatusTooManyRequests || retryAfter == "" {
		t.Fatalf("expected 429 + Retry-After when FIM quota full, got status=%d retryAfter=%q", status, retryAfter)
	}
}
