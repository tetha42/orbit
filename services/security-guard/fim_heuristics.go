package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

type SuspiciousMatch struct {
	Path        string `json:"path"`
	MatchedRule string `json:"matchedRule"`
	Severity    string `json:"severity"`
	Line        int    `json:"line"`
	Snippet     string `json:"snippet"`
}

type HeuristicRule struct {
	Name       string
	Severity   string
	Pattern    *regexp.Regexp
	Extensions []string
}

const (
	fimChunkSize      = 64 * 1024
	maxHeuristicBytes = 2 * 1024 * 1024
	maxHashFileBytes  = int64(32 * 1024 * 1024)
)

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
		Name:     "NODE_CHILD_PROCESS_EXEC",
		Severity: "CRITICAL",
		Pattern: regexp.MustCompile(
			`(?i)(?:child_process\.(?:exec|spawn|fork|execSync|spawnSync|execFile|execFileSync)\s*\(|` +
				`require\s*\(\s*["'](?:node:)?child_process["']\)|` +
				`import\s*\(\s*["'](?:node:)?child_process["']\)|` +
				`(?:exec|spawn|execFile)\s*\(\s*["'](?:\/bin\/(?:ba)?sh|sh|bash|cmd(?:\.exe)?|powershell))`,
		),
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
		Pattern: regexp.MustCompile(
			`(?i)(?:\/dev\/(?:tcp|udp)\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d+|` +
				`(?:nc|ncat|netcat)\s+.*-[eE]\s+|(?:nc|ncat|netcat)\s+-[eE]\s+|` +
				`python(?:\d)?\s+-c\s+['"].*(?:socket.*connect|pty\.spawn)|` +
				`perl\s+-e\s+['"].*socket.*connect|ruby\s+-e\s+['"].*TCPSocket|mkfifo\s+\/tmp)`,
		),
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
	".php": true, ".phtml": true, ".php5": true, ".phar": true, ".inc": true,
	".sh": true, ".bash": true, ".js": true, ".mjs": true, ".cjs": true,
	".ts": true, ".tsx": true, ".py": true, ".pl": true, ".rb": true,
	".jsp": true, ".asp": true, ".aspx": true, ".cgi": true,
	".html": true, ".htm": true, ".json": true, ".go": true,
}

var fimBufPool = sync.Pool{
	New: func() any {
		buf := make([]byte, fimChunkSize)
		return &buf
	},
}

var (
	globalHeuristicRules []HeuristicRule
	rulesByExt           map[string][]HeuristicRule
)

func init() {
	rulesByExt = make(map[string][]HeuristicRule, len(scannableExtensions))
	for _, rule := range heuristicRules {
		if len(rule.Extensions) == 0 {
			globalHeuristicRules = append(globalHeuristicRules, rule)
		}
	}
	for ext := range scannableExtensions {
		var matched []HeuristicRule
		for _, rule := range heuristicRules {
			if len(rule.Extensions) == 0 {
				matched = append(matched, rule)
				continue
			}
			for _, allowed := range rule.Extensions {
				if ext == allowed {
					matched = append(matched, rule)
					break
				}
			}
		}
		rulesByExt[ext] = matched
	}
}

func isSelfInspectorPath(slashPath string) bool {
	return strings.HasSuffix(slashPath, "tools/fim/main.go") ||
		strings.HasSuffix(slashPath, "services/security-guard/fim.go") ||
		strings.HasSuffix(slashPath, "services/security-guard/fim_baseline.go") ||
		strings.HasSuffix(slashPath, "services/security-guard/fim_heuristics.go") ||
		strings.HasSuffix(slashPath, "services/security-guard/fim_test.go") ||
		strings.HasSuffix(slashPath, "src/db/repositories/inspection/heuristicRules.ts") ||
		strings.HasSuffix(slashPath, "tests/security/security-e2e.mjs") ||
		strings.HasSuffix(slashPath, "scripts/security-e2e-test.mjs")
}

func scanHeuristicLines(r io.Reader, relPath string, rules []HeuristicRule, scanBuf []byte) ([]SuspiciousMatch, error) {
	var matches []SuspiciousMatch
	scanner := bufio.NewScanner(r)
	scanner.Buffer(scanBuf, 1024*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if len(line) == 0 {
			continue
		}

		for _, rule := range rules {
			if rule.Pattern.MatchString(line) {
				snippet := strings.TrimSpace(line)
				if len(snippet) > 160 {
					snippet = snippet[:160] + "..."
				}
				matches = append(matches, SuspiciousMatch{
					Path:        relPath,
					MatchedRule: rule.Name,
					Severity:    rule.Severity,
					Line:        lineNum,
					Snippet:     snippet,
				})
				break
			}
		}
	}

	return matches, scanner.Err()
}

func hashAndInspectFileGo(filePath, relPath, scope string) (string, []SuspiciousMatch, bool, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", nil, false, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return "", nil, false, err
	}
	if !stat.Mode().IsRegular() || stat.Size() > maxHashFileBytes {
		return "", nil, true, nil
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	slashPath := filepath.ToSlash(filePath)
	isUploadOrTmp := scope == "uploads" || scope == "tmp" ||
		strings.Contains(slashPath, "data/uploads") || strings.HasPrefix(slashPath, "/tmp")

	shouldInspect := (isUploadOrTmp || scannableExtensions[ext]) &&
		(isUploadOrTmp || (!isSelfInspectorPath(slashPath) && !isBaselineStateFile(filePath, ""))) &&
		stat.Size() <= maxHeuristicBytes

	hasher := sha256.New()
	bufPtr := fimBufPool.Get().(*[]byte)
	buf := *bufPtr
	defer fimBufPool.Put(bufPtr)

	if !shouldInspect {
		if _, err := io.CopyBuffer(hasher, file, buf); err != nil {
			return "", nil, false, err
		}
		return hex.EncodeToString(hasher.Sum(nil)), nil, false, nil
	}

	tee := io.TeeReader(file, hasher)
	n, readErr := io.ReadFull(tee, buf)
	if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
		return "", nil, false, readErr
	}

	head := buf[:n]
	if (scope == "uploads" || strings.Contains(slashPath, "data/uploads")) && n >= 2 {
		isElf := n >= 4 && head[0] == 0x7f && head[1] == 'E' && head[2] == 'L' && head[3] == 'F'
		isPe := head[0] == 'M' && head[1] == 'Z'
		if isElf || isPe {
			if readErr == nil {
				if _, err := io.CopyBuffer(hasher, file, buf); err != nil {
					return "", nil, false, err
				}
			}
			return hex.EncodeToString(hasher.Sum(nil)), []SuspiciousMatch{
				{
					Path:        relPath,
					MatchedRule: "EXECUTABLE_BINARY_IN_UPLOADS",
					Severity:    "CRITICAL",
					Line:        1,
					Snippet:     "[Compiled ELF / PE binary executable file detected in uploads directory]",
				},
			}, false, nil
		}
	}

	if n == 0 {
		return hex.EncodeToString(hasher.Sum(nil)), nil, false, nil
	}

	binaryCheckLen := n
	if binaryCheckLen > 512 {
		binaryCheckLen = 512
	}
	if bytes.IndexByte(head[:binaryCheckLen], 0) >= 0 {
		if readErr == nil {
			if _, err := io.CopyBuffer(hasher, file, buf); err != nil {
				return "", nil, false, err
			}
		}
		return hex.EncodeToString(hasher.Sum(nil)), nil, false, nil
	}

	rules := heuristicRules
	if !isUploadOrTmp {
		if extRules, ok := rulesByExt[ext]; ok {
			rules = extRules
		} else {
			rules = globalHeuristicRules
		}
	}

	scanBufPtr := fimBufPool.Get().(*[]byte)
	scanBuf := *scanBufPtr
	defer fimBufPool.Put(scanBufPtr)

	var reader io.Reader = bytes.NewReader(head)
	if readErr == nil {
		reader = io.MultiReader(reader, tee)
	}

	matches, scanErr := scanHeuristicLines(reader, relPath, rules, scanBuf)
	if scanErr != nil && readErr == nil {
		if _, err := io.CopyBuffer(hasher, file, scanBuf); err != nil {
			return "", nil, false, err
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), matches, false, nil
}
