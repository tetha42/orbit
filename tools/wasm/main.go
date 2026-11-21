package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"regexp"
	"strings"
	"syscall/js"
)

var (
	docRegex  = regexp.MustCompile(`^(?:BEU-EVRAK|BEU-DOC|ORBIT-DOC)-\d{5,9}$`)
	certRegex = regexp.MustCompile(`^(?:(?:ORB|ORBIT|BEU)-\d{4}-[A-Z0-9]{3,4}-[A-Z0-9]{4}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$`)
)

func wasmSha256(this js.Value, args []js.Value) any {
	if len(args) == 0 {
		return ""
	}
	data := args[0].String()
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

func verifyCertificate(this js.Value, args []js.Value) any {
	if len(args) == 0 {
		return js.ValueOf(map[string]any{"valid": false, "kind": "unknown"})
	}
	code := strings.ToUpper(strings.TrimSpace(args[0].String()))

	if docRegex.MatchString(code) {
		return js.ValueOf(map[string]any{"valid": true, "kind": "official_doc"})
	}
	if certRegex.MatchString(code) {
		return js.ValueOf(map[string]any{"valid": true, "kind": "certificate"})
	}
	return js.ValueOf(map[string]any{"valid": false, "kind": "unknown"})
}

func timingSafeEqual(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return false
	}
	a := []byte(args[0].String())
	b := []byte(args[1].String())
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

func main() {
	c := make(chan struct{})
	js.Global().Set("__orbit_wasm_sha256", js.FuncOf(wasmSha256))
	js.Global().Set("__orbit_wasm_verify_certificate", js.FuncOf(verifyCertificate))
	js.Global().Set("__orbit_wasm_timing_safe_equal", js.FuncOf(timingSafeEqual))
	js.Global().Set("__orbit_wasm_active", js.ValueOf(true))
	<-c
}
