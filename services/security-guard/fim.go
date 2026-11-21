package main

import (
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const fimWorkerCount = 8

type fimJob struct {
	path    string
	relPath string
	entry   fs.DirEntry
}

type fimWorkerResult struct {
	hashes     map[string]string
	suspicious []SuspiciousMatch
	errors     []string
}

func (fe *FimEngine) Scan(rootDir string, saveAsBaseline bool) (*FimScanResult, error) {
	scope, resolved, err := ResolveTargetDir(fe.rootDir, rootDir)
	if err != nil {
		return nil, err
	}
	return fe.ScanWithScope(scope, resolved, saveAsBaseline)
}

func (fe *FimEngine) ScanWithScope(scope, targetDir string, saveAsBaseline bool) (*FimScanResult, error) {
	start := time.Now()
	res := &FimScanResult{
		TargetDir:       targetDir,
		TargetKey:       scope,
		Timestamp:       start.UnixMilli(),
		SuspiciousFiles: make([]SuspiciousMatch, 0),
		Anomalies:       make([]Anomaly, 0),
		Errors:          make([]string, 0),
	}

	absTarget, err := filepath.Abs(targetDir)
	if err == nil {
		targetDir = filepath.Clean(absTarget)
	}
	uploadsDir := filepath.ToSlash(filepath.Join(fe.rootDir, "data", "uploads"))
	customDir := filepath.ToSlash(filepath.Join(fe.rootDir, "data", "custom"))
	isUploadOrTmp := scope == "uploads" || scope == "tmp"

	var cleanBaseDir string
	var skipStateBaseDir bool
	if !isUploadOrTmp && fe.baselineDir != "" {
		cleanBaseDir = filepath.Clean(fe.baselineDir)
		skipStateBaseDir = strings.HasSuffix(filepath.ToSlash(cleanBaseDir), "/state")
	}

	jobs := make(chan fimJob, 64)
	workerRes := make([]fimWorkerResult, fimWorkerCount)
	var wg sync.WaitGroup

	for w := 0; w < fimWorkerCount; w++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			local := &workerRes[idx]
			local.hashes = make(map[string]string)
			for job := range jobs {
				info, infoErr := job.entry.Info()
				if infoErr != nil || !info.Mode().IsRegular() || info.Size() > maxHashFileBytes {
					continue
				}
				hash, matches, skipped, hashErr := hashAndInspectFileGo(job.path, job.relPath, scope)
				if hashErr != nil {
					local.errors = append(local.errors, hashErr.Error())
					continue
				}
				if skipped {
					continue
				}
				local.hashes[job.relPath] = hash
				if len(matches) > 0 {
					local.suspicious = append(local.suspicious, matches...)
				}
			}
		}(w)
	}

	walkErr := filepath.WalkDir(targetDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			name := d.Name()
			if name == ".git" || name == "node_modules" || name == ".next" || name == "dist" {
				return filepath.SkipDir
			}
			slashDir := filepath.ToSlash(path)
			if strings.HasSuffix(slashDir, "/tools/bin") {
				return filepath.SkipDir
			}
			if scope == "repo" && (slashDir == uploadsDir || slashDir == customDir) {
				return filepath.SkipDir
			}
			if skipStateBaseDir && filepath.Clean(path) == cleanBaseDir {
				return filepath.SkipDir
			}
			return nil
		}

		typ := d.Type()
		if !typ.IsRegular() && typ != fs.ModeIrregular {
			return nil
		}

		if !isUploadOrTmp && isBaselineStateFile(path, fe.baselineDir) {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !isUploadOrTmp && !scannableExtensions[ext] {
			return nil
		}

		relPath, _ := filepath.Rel(targetDir, path)
		jobs <- fimJob{
			path:    path,
			relPath: filepath.ToSlash(relPath),
			entry:   d,
		}
		return nil
	})

	close(jobs)
	wg.Wait()

	if walkErr != nil {
		return nil, walkErr
	}

	currentHashes := make(map[string]string)
	for i := range workerRes {
		for k, v := range workerRes[i].hashes {
			currentHashes[k] = v
		}
		res.SuspiciousFiles = append(res.SuspiciousFiles, workerRes[i].suspicious...)
		res.Errors = append(res.Errors, workerRes[i].errors...)
	}
	res.ScannedFiles = len(currentHashes)

	sort.Slice(res.SuspiciousFiles, func(i, j int) bool {
		if res.SuspiciousFiles[i].Path != res.SuspiciousFiles[j].Path {
			return res.SuspiciousFiles[i].Path < res.SuspiciousFiles[j].Path
		}
		if res.SuspiciousFiles[i].Line != res.SuspiciousFiles[j].Line {
			return res.SuspiciousFiles[i].Line < res.SuspiciousFiles[j].Line
		}
		return res.SuspiciousFiles[i].MatchedRule < res.SuspiciousFiles[j].MatchedRule
	})
	sort.Strings(res.Errors)

	fe.mu.RLock()
	oldBaseline := fe.baselines[scope]
	fe.mu.RUnlock()

	if oldBaseline != nil {
		for p, newH := range currentHashes {
			if oldH, ok := oldBaseline[p]; !ok {
				res.Anomalies = append(res.Anomalies, Anomaly{Path: p, Type: "added", NewHash: newH})
			} else if oldH != newH {
				res.Anomalies = append(res.Anomalies, Anomaly{Path: p, Type: "modified", OldHash: oldH, NewHash: newH})
			}
		}
		for p, oldH := range oldBaseline {
			if _, ok := currentHashes[p]; !ok {
				res.Anomalies = append(res.Anomalies, Anomaly{Path: p, Type: "deleted", OldHash: oldH})
			}
		}
		sort.Slice(res.Anomalies, func(i, j int) bool {
			if res.Anomalies[i].Path != res.Anomalies[j].Path {
				return res.Anomalies[i].Path < res.Anomalies[j].Path
			}
			return res.Anomalies[i].Type < res.Anomalies[j].Type
		})
	}

	if saveAsBaseline {
		if err := fe.SaveBaseline(scope, currentHashes); err == nil {
			res.BaselineSaved = true
		}
	}

	res.DurationMs = time.Since(start).Milliseconds()

	fe.mu.Lock()
	fe.lastResult = res
	fe.mu.Unlock()

	return res, nil
}
