package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Anomaly struct {
	Path    string `json:"path"`
	Type    string `json:"type"` // "added", "modified", "deleted"
	OldHash string `json:"oldHash,omitempty"`
	NewHash string `json:"newHash,omitempty"`
}

type FimScanResult struct {
	TargetDir       string            `json:"targetDir"`
	TargetKey       string            `json:"targetKey,omitempty"`
	ScannedFiles    int               `json:"scannedFiles"`
	DurationMs      int64             `json:"durationMs"`
	Timestamp       int64             `json:"timestamp"`
	SuspiciousFiles []SuspiciousMatch `json:"suspiciousFiles"`
	Anomalies       []Anomaly         `json:"anomalies"`
	BaselineSaved   bool              `json:"baselineSaved"`
	Errors          []string          `json:"errors"`
}

type FimEngine struct {
	mu          sync.RWMutex
	rootDir     string
	baselineDir string
	baselines   map[string]map[string]string
	lastResult  *FimScanResult
}

func NewFimEngine(rootDir, baselineDir string) *FimEngine {
	if absRoot, err := filepath.Abs(rootDir); err == nil {
		rootDir = absRoot
	}
	if baselineDir != "" {
		if absBase, err := filepath.Abs(baselineDir); err == nil {
			baselineDir = absBase
		}
	}
	engine := &FimEngine{
		rootDir:     rootDir,
		baselineDir: baselineDir,
		baselines:   make(map[string]map[string]string),
	}
	for _, scope := range []string{"repo", "uploads", "tmp", "custom"} {
		engine.loadBaseline(scope)
	}
	return engine
}

func (fe *FimEngine) baselineFileForScope(scope string) string {
	switch scope {
	case "uploads":
		return filepath.Join(fe.baselineDir, "baseline-uploads.json")
	case "tmp":
		return filepath.Join(fe.baselineDir, "baseline-tmp.json")
	case "custom":
		return filepath.Join(fe.baselineDir, "baseline-custom.json")
	default:
		return filepath.Join(fe.baselineDir, "baseline.json")
	}
}

func (fe *FimEngine) loadBaseline(scope string) {
	fe.mu.Lock()
	defer fe.mu.Unlock()

	path := fe.baselineFileForScope(scope)
	data, err := os.ReadFile(path)
	if err == nil {
		m := make(map[string]string)
		if json.Unmarshal(data, &m) == nil {
			fe.baselines[scope] = m
		}
	}
}

func (fe *FimEngine) SaveBaseline(scope string, hashes map[string]string) error {
	fe.mu.Lock()
	defer fe.mu.Unlock()

	path := fe.baselineFileForScope(scope)
	data, err := json.MarshalIndent(hashes, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}
	fe.baselines[scope] = hashes
	return nil
}

// ResolveTargetDir enforces an allowlist of target keys or paths strictly inside rootDir or /tmp.
func ResolveTargetDir(rootDir, target string) (string, string, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return "", "", err
	}
	absRoot = filepath.Clean(absRoot)

	trimmed := strings.TrimSpace(target)
	if strings.Contains(trimmed, "..") {
		return "", "", errors.New("access denied: path traversal is not allowed")
	}
	lower := strings.ToLower(trimmed)

	switch lower {
	case "", "repo", "src":
		return "repo", absRoot, nil
	case "uploads":
		return "uploads", filepath.Join(absRoot, "data", "uploads"), nil
	case "tmp":
		return "tmp", "/tmp", nil
	}

	var candidate string
	if filepath.IsAbs(trimmed) {
		candidate = filepath.Clean(trimmed)
	} else {
		candidate = filepath.Clean(filepath.Join(absRoot, trimmed))
	}

	// Resolve symlinks on existing paths to prevent symlink escape
	if evalPath, err := filepath.EvalSymlinks(candidate); err == nil {
		candidate = evalPath
	}

	rootPrefix := absRoot
	if !strings.HasSuffix(rootPrefix, string(filepath.Separator)) {
		rootPrefix += string(filepath.Separator)
	}

	isInsideRoot := candidate == absRoot || strings.HasPrefix(candidate, rootPrefix)
	isInsideTmp := candidate == "/tmp" || strings.HasPrefix(candidate, "/tmp/")

	if !isInsideRoot && !isInsideTmp {
		return "", "", errors.New("access denied: target directory is outside allowed root or /tmp")
	}

	if isInsideTmp {
		return "tmp", candidate, nil
	}
	uploadsDir := filepath.Join(absRoot, "data", "uploads")
	if candidate == uploadsDir || strings.HasPrefix(candidate, uploadsDir+string(filepath.Separator)) {
		return "uploads", candidate, nil
	}
	if candidate == absRoot {
		return "repo", candidate, nil
	}
	return "custom", candidate, nil
}

func isBaselineStateFile(filePath, baselineDir string) bool {
	slashPath := filepath.ToSlash(filePath)
	base := filepath.Base(slashPath)

	if strings.Contains(slashPath, "tools/fim/baseline") {
		return true
	}

	if strings.Contains(slashPath, "/state/baseline") &&
		(base == "baseline.json" || (strings.HasPrefix(base, "baseline-") && strings.HasSuffix(base, ".json"))) {
		return true
	}

	if strings.Contains(slashPath, "/data/fim-baseline-") &&
		!strings.Contains(slashPath, "/data/uploads/") &&
		strings.HasSuffix(base, ".json") {
		return true
	}

	if baselineDir != "" {
		cleanBaseDir := filepath.ToSlash(filepath.Clean(baselineDir))
		if strings.HasPrefix(slashPath, cleanBaseDir+"/") &&
			(base == "baseline.json" || (strings.HasPrefix(base, "baseline-") && strings.HasSuffix(base, ".json"))) {
			return true
		}
	}

	return false
}

func (fe *FimEngine) GetLastResult() *FimScanResult {
	fe.mu.RLock()
	defer fe.mu.RUnlock()
	return fe.lastResult
}
