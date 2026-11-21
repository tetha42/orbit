package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestResolveTargetDirAllowlist(t *testing.T) {
	root := t.TempDir()

	scope, resolved, err := ResolveTargetDir(root, "repo")
	if err != nil || scope != "repo" || resolved != root {
		t.Fatalf("expected repo scope at %s, got scope=%s path=%s err=%v", root, scope, resolved, err)
	}

	scope, resolved, err = ResolveTargetDir(root, "uploads")
	if err != nil || scope != "uploads" || resolved != filepath.Join(root, "data", "uploads") {
		t.Fatalf("expected uploads scope, got scope=%s path=%s err=%v", scope, resolved, err)
	}

	scope, resolved, err = ResolveTargetDir(root, "tmp")
	if err != nil || scope != "tmp" || resolved != "/tmp" {
		t.Fatalf("expected tmp scope, got scope=%s path=%s err=%v", scope, resolved, err)
	}

	// Path traversal attempts must be rejected
	for _, bad := range []string{"/etc", "../../etc/passwd", "/root/.ssh"} {
		if _, _, err := ResolveTargetDir(root, bad); err == nil {
			t.Fatalf("expected path traversal %q to be rejected", bad)
		}
	}
}

func TestPerTargetBaselineIsolationAndHeuristics(t *testing.T) {
	root := t.TempDir()
	baselineDir := t.TempDir()
	uploadsDir := filepath.Join(root, "data", "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create clean repo file
	repoFile := filepath.Join(root, "index.ts")
	if err := os.WriteFile(repoFile, []byte("export const ok = true;\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create malicious upload file (PHP webshell on line 2) and ELF binary
	shellFile := filepath.Join(uploadsDir, "shell.php")
	if err := os.WriteFile(shellFile, []byte("<?php\neval($_POST['cmd']);\n"), 0644); err != nil {
		t.Fatal(err)
	}
	elfFile := filepath.Join(uploadsDir, "payload.bin")
	if err := os.WriteFile(elfFile, []byte{0x7f, 'E', 'L', 'F', 0x00, 0x01}, 0644); err != nil {
		t.Fatal(err)
	}

	engine := NewFimEngine(root, baselineDir)

	// Save repo baseline
	repoRes, err := engine.ScanWithScope("repo", root, true)
	if err != nil {
		t.Fatal(err)
	}
	if !repoRes.BaselineSaved || repoRes.ScannedFiles == 0 {
		t.Fatalf("expected repo baseline saved with >0 files, got %+v", repoRes)
	}

	// Scan uploads and save uploads baseline — must NOT overwrite repo baseline
	upRes, err := engine.ScanWithScope("uploads", uploadsDir, true)
	if err != nil {
		t.Fatal(err)
	}
	if !upRes.BaselineSaved || upRes.ScannedFiles != 2 {
		t.Fatalf("expected 2 uploaded files scanned, got %+v", upRes)
	}
	if len(upRes.SuspiciousFiles) != 2 {
		t.Fatalf("expected 2 suspicious findings in uploads (PHP + ELF), got %+v", upRes.SuspiciousFiles)
	}

	// Verify line number on PHP finding is 2 (not hardcoded 1)
	foundLine2 := false
	foundElf := false
	for _, m := range upRes.SuspiciousFiles {
		if m.MatchedRule == "PHP_EVAL_BASE64" && m.Line == 2 {
			foundLine2 = true
		}
		if m.MatchedRule == "EXECUTABLE_BINARY_IN_UPLOADS" {
			foundElf = true
		}
	}
	if !foundLine2 || !foundElf {
		t.Fatalf("expected PHP_EVAL_BASE64 on line 2 and EXECUTABLE_BINARY_IN_UPLOADS, got %+v", upRes.SuspiciousFiles)
	}

	// Re-scan repo: must have 0 deleted anomalies (uploads baseline did not clobber repo baseline)
	repoRes2, err := engine.ScanWithScope("repo", root, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(repoRes2.Anomalies) != 0 {
		t.Fatalf("expected 0 repo anomalies after uploads scan, got %+v", repoRes2.Anomalies)
	}
}

func TestHandleFimScanRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	srv := &Server{
		fim:       NewFimEngine(root, t.TempDir()),
		telemetry: NewTelemetryCollector(),
		rootDir:   root,
	}

	body, _ := json.Marshal(map[string]any{"targetDir": "/etc"})
	req := httptest.NewRequest(http.MethodPost, "/api/fim/scan", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	srv.handleFimScan(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for /etc traversal, got %d", rec.Code)
	}
}

func TestRepoScanExcludesBaselineStateFiles(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	toolsFimDir := filepath.Join(root, "tools", "fim")
	dataDir := filepath.Join(root, "data")
	uploadsDir := filepath.Join(dataDir, "uploads")
	srcDir := filepath.Join(root, "src")

	for _, d := range []string{stateDir, toolsFimDir, uploadsDir, srcDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Pre-populate baseline files inside /state, tools/fim, and data/
	for _, bf := range []string{
		filepath.Join(stateDir, "baseline.json"),
		filepath.Join(stateDir, "baseline-uploads.json"),
		filepath.Join(stateDir, "baseline-tmp.json"),
		filepath.Join(toolsFimDir, "baseline.json"),
		filepath.Join(dataDir, "fim-baseline-uploads.json"),
		filepath.Join(dataDir, "fim-baseline-tmp.json"),
	} {
		if err := os.WriteFile(bf, []byte(`{"dummy":"hash"}`), 0644); err != nil {
			t.Fatal(err)
		}
	}

	engine := NewFimEngine(root, stateDir)

	// When no real source files exist, repo scan MUST return 0 (must not count baseline files as repo code)
	emptyRepoRes, err := engine.ScanWithScope("repo", root, false)
	if err != nil {
		t.Fatal(err)
	}
	if emptyRepoRes.ScannedFiles != 0 {
		t.Fatalf("expected 0 scanned files when only baseline JSONs exist, got %d", emptyRepoRes.ScannedFiles)
	}

	// Add one real source file, save repo & uploads baselines, and verify no self-referential anomalies
	if err := os.WriteFile(filepath.Join(srcDir, "index.ts"), []byte("export const ready = true;\n"), 0644); err != nil {
		t.Fatal(err)
	}
	repoRes, err := engine.ScanWithScope("repo", root, true)
	if err != nil {
		t.Fatal(err)
	}
	if !repoRes.BaselineSaved || repoRes.ScannedFiles != 1 {
		t.Fatalf("expected exactly 1 scanned source file, got %+v", repoRes)
	}

	if _, err := engine.ScanWithScope("uploads", uploadsDir, true); err != nil {
		t.Fatal(err)
	}

	repoResAfter, err := engine.ScanWithScope("repo", root, false)
	if err != nil {
		t.Fatal(err)
	}
	if repoResAfter.ScannedFiles != 1 || len(repoResAfter.Anomalies) != 0 {
		t.Fatalf("expected 1 scanned file and 0 anomalies, got %+v", repoResAfter)
	}
}

func TestUploadsAllowsBaselineNamedPayloadAndDetectsEmptyBaselineAdditions(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	uploadsDir := filepath.Join(root, "data", "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	engine := NewFimEngine(root, stateDir)

	// Save baseline on empty uploads directory
	initial, err := engine.ScanWithScope("uploads", uploadsDir, true)
	if err != nil {
		t.Fatal(err)
	}
	if !initial.BaselineSaved || initial.ScannedFiles != 0 {
		t.Fatalf("expected empty uploads baseline saved with 0 files, got %+v", initial)
	}

	// Attacker drops a webshell named baseline-evil.php in uploads
	if err := os.WriteFile(filepath.Join(uploadsDir, "baseline-evil.php"), []byte("<?php eval($_POST['x']); ?>\n"), 0644); err != nil {
		t.Fatal(err)
	}

	res, err := engine.ScanWithScope("uploads", uploadsDir, false)
	if err != nil {
		t.Fatal(err)
	}
	if res.ScannedFiles != 1 {
		t.Fatalf("expected 1 scanned file in uploads, got %d", res.ScannedFiles)
	}
	if len(res.SuspiciousFiles) != 1 {
		t.Fatalf("expected baseline-named PHP payload in uploads to be flagged, got %+v", res.SuspiciousFiles)
	}
	if len(res.Anomalies) != 1 || res.Anomalies[0].Type != "added" {
		t.Fatalf("expected 1 added anomaly after empty uploads baseline, got %+v", res.Anomalies)
	}
}

func TestRepoScanExcludesUploadsAndCustomDirs(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	uploadsDir := filepath.Join(root, "data", "uploads")
	customDir := filepath.Join(root, "data", "custom")
	srcDir := filepath.Join(root, "src")

	for _, d := range []string{stateDir, uploadsDir, customDir, srcDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}

	if err := os.WriteFile(filepath.Join(srcDir, "app.ts"), []byte("export const v = 1;\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadsDir, "user.html"), []byte("<p>hi</p>\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(customDir, "branding.json"), []byte(`{"theme":"dark"}`), 0644); err != nil {
		t.Fatal(err)
	}

	engine := NewFimEngine(root, stateDir)
	repoRes, err := engine.ScanWithScope("repo", root, true)
	if err != nil {
		t.Fatal(err)
	}
	if repoRes.ScannedFiles != 1 {
		t.Fatalf("expected repo scan to count only src/app.ts (1 file), got %d", repoRes.ScannedFiles)
	}
}

func TestScanSkipsNonRegularFilesAndScansUploadBaselineNamedJs(t *testing.T) {
	root := t.TempDir()
	uploadsDir := filepath.Join(root, "data", "uploads")
	nestedStateDir := filepath.Join(uploadsDir, "state")
	if err := os.MkdirAll(nestedStateDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create a FIFO named pipe and symlink — scanner MUST skip both without blocking or escaping
	fifoPath := filepath.Join(uploadsDir, "pipe.fifo")
	if err := syscall.Mkfifo(fifoPath, 0600); err != nil {
		t.Fatal(err)
	}
	symPath := filepath.Join(uploadsDir, "passwd.link")
	if err := os.Symlink("/etc/passwd", symPath); err != nil {
		t.Fatal(err)
	}

	// Upload a malicious JS payload disguised under state/baseline.json path inside uploads
	evilUpload := filepath.Join(nestedStateDir, "baseline.json")
	if err := os.WriteFile(evilUpload, []byte(`require("child_process");`), 0644); err != nil {
		t.Fatal(err)
	}

	engine := NewFimEngine(root, filepath.Join(root, "guard-state"))
	res, err := engine.ScanWithScope("uploads", uploadsDir, false)
	if err != nil {
		t.Fatal(err)
	}
	if res.ScannedFiles != 1 {
		t.Fatalf("expected 1 regular file scanned (FIFO and symlink skipped), got %d", res.ScannedFiles)
	}
	if len(res.SuspiciousFiles) != 1 {
		t.Fatalf("expected malicious upload inside uploads/state/baseline.json to be flagged, got %+v", res.SuspiciousFiles)
	}
}

func TestRelativeBaselineDirExcludedFromRepoScanAndInvalidJsonRejected(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	customBaseDir := filepath.Join(root, "custom-guard-baselines")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(customBaseDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "main.ts"), []byte("export const ok = 1;\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(customBaseDir, "baseline.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}

	origWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(origWd) }()

	engine := NewFimEngine(".", "custom-guard-baselines")
	res, err := engine.ScanWithScope("repo", ".", false)
	if err != nil {
		t.Fatal(err)
	}
	if res.ScannedFiles != 1 {
		t.Fatalf("expected relative baseline dir to be excluded (1 repo file), got %d", res.ScannedFiles)
	}

	srv := &Server{
		fim:       engine,
		telemetry: NewTelemetryCollector(),
		rootDir:   root,
	}
	req := httptest.NewRequest(http.MethodPost, "/api/fim/scan", bytes.NewBufferString("{bad-json"))
	rec := httptest.NewRecorder()
	srv.handleFimScan(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for malformed JSON, got %d", rec.Code)
	}
}

func TestNullFreeExecutableHeadersDetectedInUploads(t *testing.T) {
	root := t.TempDir()
	baselineDir := t.TempDir()
	uploadsDir := filepath.Join(root, "data", "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(uploadsDir, "elf.png"), []byte{0x7f, 'E', 'L', 'F', 0x02, 0x01}, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadsDir, "pe.jpg"), []byte{'M', 'Z', 0x90, 0x01}, 0644); err != nil {
		t.Fatal(err)
	}

	engine := NewFimEngine(root, baselineDir)
	res, err := engine.ScanWithScope("uploads", uploadsDir, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.SuspiciousFiles) != 2 {
		t.Fatalf("expected both null-free ELF and PE uploads to trigger EXECUTABLE_BINARY_IN_UPLOADS, got %+v", res.SuspiciousFiles)
	}
}
