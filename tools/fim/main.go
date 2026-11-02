package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type SuspiciousMatch struct {
	Path        string `json:"path"`
	MatchedRule string `json:"matchedRule"`
	Severity    string `json:"severity"`
	Line        int    `json:"line"`
	Snippet     string `json:"snippet"`
}

type Anomaly struct {
	Path    string `json:"path"`
	Type    string `json:"type"` // "added", "modified", "deleted"
	OldHash string `json:"oldHash,omitempty"`
	NewHash string `json:"newHash,omitempty"`
}

type ScanResult struct {
	TargetDir       string            `json:"targetDir"`
	ScannedFiles    int               `json:"scannedFiles"`
	DurationMs      int64             `json:"durationMs"`
	Timestamp       int64             `json:"timestamp"`
	SuspiciousFiles []SuspiciousMatch `json:"suspiciousFiles"`
	Anomalies       []Anomaly         `json:"anomalies"`
	BaselineSaved   bool              `json:"baselineSaved"`
	Errors          []string          `json:"errors"`
}

type HeuristicRule struct {
	Name       string
	Severity   string
	Pattern    *regexp.Regexp
	Extensions []string
}

var phpExtensions = []string{".php", ".phtml", ".php5", ".phar", ".inc"}
var nodeExtensions = []string{".js", ".mjs", ".cjs", ".ts", ".tsx"}

var heuristicRules = []HeuristicRule{
	{
		Name:       "PHP_EVAL_BASE64",
		Severity:   "CRITICAL",
		Pattern:    regexp.MustCompile(`(?i)(?:eval\s*\(|assert\s*\(\s*["']|\$\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*|create_function\s*\(|preg_replace\s*\(\s*["'][^"']*\/e["'])`),
		Extensions: phpExtensions,
	},
	{
		Name:       "SHELL_COMMAND_EXEC",
		Severity:   "CRITICAL",
		Pattern:    regexp.MustCompile(`(?i)(?:passthru|shell_exec|system|popen|proc_open|pcntl_exec)\s*\(`),
		Extensions: phpExtensions,
	},
	{
		Name:       "NODE_CHILD_PROCESS_EXEC",
		Severity:   "CRITICAL",
		Pattern:    regexp.MustCompile(`(?i)(?:child_process\.(?:exec|spawn|fork|execSync|spawnSync|execFile|execFileSync)\s*\(|require\s*\(\s*["'](?:node:)?child_process["']\)|import\s*\(\s*["'](?:node:)?child_process["']\)|(?:exec|spawn|execFile)\s*\(\s*["'](?:\/bin\/(?:ba)?sh|sh|bash|cmd(?:\.exe)?|powershell))`),
		Extensions: nodeExtensions,
	},
	{
		Name:     "BACKDOOR_FILE_WRITE",
		Severity: "HIGH",
		Pattern:  regexp.MustCompile(`(?i)(?:fs\.writeFileSync|fs\.writeFile|file_put_contents)\s*\([^,]+(?:\.php|\.phtml|\.phar|\.sh|\.bash|\.elf|\.exe|\.cgi)`),
	},
	{
		Name:     "REVERSE_SHELL_NET",
		Severity: "CRITICAL",
		Pattern:  regexp.MustCompile(`(?i)(?:\/dev\/(?:tcp|udp)\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d+|(?:nc|ncat|netcat)\s+.*-[eE]\s+|(?:nc|ncat|netcat)\s+-[eE]\s+|python(?:\d)?\s+-c\s+['"].*(?:socket.*connect|pty\.spawn)|perl\s+-e\s+['"].*socket.*connect|ruby\s+-e\s+['"].*TCPSocket|mkfifo\s+\/tmp)`),
	},
	{
		Name:     "POWERSHELL_OR_CURL_PIPE",
		Severity: "HIGH",
		Pattern:  regexp.MustCompile(`(?i)(?:powershell(?:\.exe)?\s+-(?:enc|encodedcommand)\s+[a-zA-Z0-9+/=]{16,}|(?:curl|wget)\s+-[sS]?\s+.*\|\s*(?:bash|sh))`),
	},
	{
		Name:     "OBFUSCATED_PAYLOAD",
		Severity: "HIGH",
		Pattern:  regexp.MustCompile(`(?i)(?:\\x[0-9a-fA-F]{2}){8,}|base64_decode\s*\(\s*['"]?[a-zA-Z0-9+/=]{24,}|(?:gzinflate|gzuncompress|gzdecode|str_rot13|hex2bin)\s*\(`),
	},
	{
		Name:     "INTERACTIVE_SHELL_SPAWN",
		Severity: "CRITICAL",
		Pattern:  regexp.MustCompile(`(?i)(?:pty\.spawn\s*\(\s*["'](?:\/bin\/)?(?:ba)?sh["']|execve\s*\(\s*["']\/bin\/(?:ba)?sh|bash\s+-i\s+>&|\/bin\/(?:ba)?sh\s+-i\s+>&)`),
	},
}

var scannableExtensions = map[string]bool{
	".php":   true,
	".phtml": true,
	".php5":  true,
	".phar":  true,
	".inc":   true,
	".sh":    true,
	".bash":  true,
	".js":    true,
	".mjs":   true,
	".cjs":   true,
	".ts":    true,
	".tsx":   true,
	".py":    true,
	".pl":    true,
	".rb":    true,
	".jsp":   true,
	".asp":   true,
	".aspx":  true,
	".cgi":   true,
	".html":  true,
	".htm":   true,
}

func isExcludedPath(path string, excludes []string) bool {
	normalized := filepath.ToSlash(path)
	for _, excl := range excludes {
		if strings.TrimSpace(excl) == "" {
			continue
		}
		exclNorm := filepath.ToSlash(strings.TrimSpace(excl))
		if strings.Contains(normalized, "/"+exclNorm+"/") ||
			strings.HasPrefix(normalized, exclNorm+"/") ||
			strings.HasSuffix(normalized, "/"+exclNorm) ||
			normalized == exclNorm {
			return true
		}
	}
	return false
}

func computeSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func isBinaryFile(f *os.File) bool {
	buf := make([]byte, 512)
	n, err := f.ReadAt(buf, 0)
	if err != nil && err != io.EOF {
		return false
	}
	for i := 0; i < n; i++ {
		if buf[i] == 0 {
			return true
		}
	}
	return false
}

func checkFileSuspicious(filePath string, maxBytes int64) ([]SuspiciousMatch, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	// Always scan uploads or tmp files even if they lack extension or have odd extensions
	isUploadOrTmp := strings.Contains(filePath, "data/uploads") || strings.Contains(filePath, "/tmp")
	if !isUploadOrTmp && !scannableExtensions[ext] {
		return nil, nil
	}

	// Never self-flag the scanner source file, test fixtures, or baseline
	if strings.HasSuffix(filePath, "tools/fim/main.go") ||
		strings.HasSuffix(filePath, "tests/security/security-e2e.mjs") ||
		strings.HasSuffix(filePath, "scripts/security-e2e-test.mjs") ||
		strings.HasSuffix(filePath, "tools/fim/baseline.json") {
		return nil, nil
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if stat.Size() > maxBytes {
		return nil, nil // Skip huge files for regex scanning
	}

	if isBinaryFile(file) {
		// If an ELF or PE executable is found in data/uploads, flag it as critical
		if strings.Contains(filePath, "data/uploads") {
			buf := make([]byte, 4)
			_, _ = file.ReadAt(buf, 0)
			if (buf[0] == 0x7f && buf[1] == 'E' && buf[2] == 'L' && buf[3] == 'F') ||
				(buf[0] == 'M' && buf[1] == 'Z') {
				return []SuspiciousMatch{
					{
						Path:        filePath,
						MatchedRule: "EXECUTABLE_BINARY_IN_UPLOADS",
						Severity:    "CRITICAL",
						Line:        1,
						Snippet:     "[Compiled ELF / PE binary executable file detected in uploads directory]",
					},
				}, nil
			}
		}
		// Skip regex scanning on non-text binary files (e.g. caches, archives)
		return nil, nil
	}

	var matches []SuspiciousMatch
	scanner := bufio.NewScanner(file)
	// Allow scanning lines up to 1MB
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if len(line) == 0 {
			continue
		}

		for _, rule := range heuristicRules {
			if !isUploadOrTmp && len(rule.Extensions) > 0 {
				extMatched := false
				for _, allowed := range rule.Extensions {
					if ext == allowed {
						extMatched = true
						break
					}
				}
				if !extMatched {
					continue
				}
			}
			if rule.Pattern.MatchString(line) {
				snippet := strings.TrimSpace(line)
				if len(snippet) > 160 {
					snippet = snippet[:157] + "..."
				}
				matches = append(matches, SuspiciousMatch{
					Path:        filePath,
					MatchedRule: rule.Name,
					Severity:    rule.Severity,
					Line:        lineNum,
					Snippet:     snippet,
				})
				// Record at most one match per rule per line
				break
			}
		}
	}

	return matches, scanner.Err()
}

func main() {
	targetDirFlag := flag.String("dir", ".", "Directory to scan (relative or absolute)")
	baselineFlag := flag.String("baseline", "", "Path to baseline JSON file")
	saveBaselineFlag := flag.Bool("save-baseline", false, "Save current scan hashes as new baseline")
	detectShellsFlag := flag.Bool("detect-shells", true, "Perform heuristic webshell and backdoor detection")
	maxSizeFlag := flag.Int64("max-size", 5*1024*1024, "Maximum file size in bytes to scan for patterns")
	workersFlag := flag.Int("workers", 8, "Number of concurrent worker goroutines")
	excludesFlag := flag.String("excludes", ".git,node_modules,.next,dist,tools/bin", "Comma-separated list of directories/patterns to exclude")
	flag.Parse()

	startTime := time.Now()
	res := ScanResult{
		TargetDir:       *targetDirFlag,
		Timestamp:       time.Now().UnixMilli(),
		SuspiciousFiles: make([]SuspiciousMatch, 0),
		Anomalies:       make([]Anomaly, 0),
		Errors:          make([]string, 0),
	}

	excludes := strings.Split(*excludesFlag, ",")
	absTargetDir, err := filepath.Abs(*targetDirFlag)
	if err != nil {
		res.Errors = append(res.Errors, fmt.Sprintf("invalid target dir: %v", err))
		outputJSON(res)
		return
	}
	res.TargetDir = absTargetDir

	// Read existing baseline if provided
	existingBaseline := make(map[string]string)
	if *baselineFlag != "" {
		if data, err := os.ReadFile(*baselineFlag); err == nil {
			var raw map[string]string
			if err := json.Unmarshal(data, &raw); err == nil {
				for p, h := range raw {
					if filepath.IsAbs(p) {
						if rel, rErr := filepath.Rel(absTargetDir, p); rErr == nil {
							existingBaseline[rel] = h
							continue
						}
					}
					existingBaseline[p] = h
				}
			}
		}
	}

	// Channel of files to scan
	type FileJob struct {
		Path string
	}

	jobs := make(chan FileJob, 2048)
	var wg sync.WaitGroup

	var mu sync.Mutex
	currentHashes := make(map[string]string)
	scannedCount := 0

	// Worker pool
	workerCount := *workersFlag
	if workerCount < 1 {
		workerCount = 4
	}

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				hash, err := computeSHA256(job.Path)
				if err != nil {
					mu.Lock()
					res.Errors = append(res.Errors, fmt.Sprintf("hash error %s: %v", job.Path, err))
					mu.Unlock()
					continue
				}

				var suspicious []SuspiciousMatch
				if *detectShellsFlag {
					s, _ := checkFileSuspicious(job.Path, *maxSizeFlag)
					suspicious = s
				}

				relPath := job.Path
				if rel, rErr := filepath.Rel(absTargetDir, job.Path); rErr == nil {
					relPath = rel
				}

				mu.Lock()
				scannedCount++
				currentHashes[relPath] = hash
				if len(suspicious) > 0 {
					res.SuspiciousFiles = append(res.SuspiciousFiles, suspicious...)
				}
				mu.Unlock()
			}
		}()
	}

	// Walk directory
	err = filepath.Walk(absTargetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip unreadable paths without terminating
		}
		if info.IsDir() {
			if isExcludedPath(path, excludes) {
				return filepath.SkipDir
			}
			return nil
		}
		if isExcludedPath(path, excludes) {
			return nil
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		jobs <- FileJob{Path: path}
		return nil
	})

	close(jobs)
	wg.Wait()

	if err != nil {
		res.Errors = append(res.Errors, fmt.Sprintf("walk error: %v", err))
	}

	res.ScannedFiles = scannedCount

	// Compare with baseline if baseline was loaded
	if len(existingBaseline) > 0 {
		for path, oldHash := range existingBaseline {
			if newHash, exists := currentHashes[path]; exists {
				if oldHash != newHash {
					res.Anomalies = append(res.Anomalies, Anomaly{
						Path:    path,
						Type:    "modified",
						OldHash: oldHash,
						NewHash: newHash,
					})
				}
			} else {
				res.Anomalies = append(res.Anomalies, Anomaly{
					Path:    path,
					Type:    "deleted",
					OldHash: oldHash,
				})
			}
		}
		for path, newHash := range currentHashes {
			if _, exists := existingBaseline[path]; !exists {
				res.Anomalies = append(res.Anomalies, Anomaly{
					Path:    path,
					Type:    "added",
					NewHash: newHash,
				})
			}
		}
	}

	// Save baseline if requested
	if *saveBaselineFlag && *baselineFlag != "" {
		if err := os.MkdirAll(filepath.Dir(*baselineFlag), 0755); err == nil {
			if data, err := json.MarshalIndent(currentHashes, "", "  "); err == nil {
				if err := os.WriteFile(*baselineFlag, data, 0644); err == nil {
					res.BaselineSaved = true
				} else {
					res.Errors = append(res.Errors, fmt.Sprintf("failed to save baseline: %v", err))
				}
			}
		}
	}

	res.DurationMs = time.Since(startTime).Milliseconds()
	outputJSON(res)
}

func outputJSON(res ScanResult) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(res)
}
