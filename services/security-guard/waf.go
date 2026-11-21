package main

import (
	"net/url"
	"regexp"
	"strings"
)

type WafInspectionResult struct {
	Matched   bool   `json:"matched"`
	Category  string `json:"category,omitempty"`
	Points    int    `json:"points"`
	Signature string `json:"signature,omitempty"`
}

var (
	pathTraversalRe = regexp.MustCompile(`(?i)(?:\.\.[/\\]|%2e%2e(?:%2f|%5c|[/\\])|\/etc\/(?:passwd|shadow|hosts)|\/proc\/self\/|(?:c:|\\windows)\\system32)`)
	sqliQueryRe = regexp.MustCompile(
		`(?i)(?:\bunion\s+(?:all\s+)?select\b|\bselect\b[\s\S]{1,40}\bfrom\s+` +
			`(?:information_schema|pg_shadow|pg_user|pg_catalog)\b|` +
			`(?:'|"|%27|%22)\s*(?:or|and)\s*(?:'[^']*'\s*=\s*'[^']*'|"[^"]*"\s*=\s*"[^"]*"|` +
			`\b\d+\s*=\s*\d+\b)|\bpg_sleep\s*\(|\bwaitfor\s+delay\b|\bbenchmark\s*\(\s*\d+)`,
	)
	xssQueryRe = regexp.MustCompile(
		`(?i)(?:<\s*script\b|javascript\s*:|on(?:error|load|mouseover|focus)\s*=\s*[^\s>]+|` +
			`<\s*(?:iframe|svg|img)\b[^>]*\bon\w+\s*=)`,
	)
	cmdInjectionRe = regexp.MustCompile(
		`(?i)(?:\$\{jndi:(?:ldap|rmi|dns|nis|iiop|corba|nds|http):|[;|` + "`" + `]\s*` +
			`(?:cat|ls|whoami|id|uname|curl|wget|bash|sh|nc|ncat)\b|` +
			`\$\(\s*(?:whoami|id|uname|cat|curl|wget)\b)`,
	)
	sstiQueryRe = regexp.MustCompile(
		`(?i)(?:\{\{\s*(?:\d+\s*[\*+-/]\s*\d+|config|request|app|self|lipsum|cycler|joiner|` +
			`process|mainModule)\s*\}\}|\$\{\s*(?:\d+\s*[\*+-/]\s*\d+|process|mainModule)\s*\}|` +
			`<%.*?%>)`,
	)
	protoPollutionRe = regexp.MustCompile(`(?i)(?:__proto__|constructor\s*(?:\.|\s*\[\s*['"]?)\s*prototype|\bprototype\b\s*(?:\.\s*\w+|\[))`)
	scannerUaRe     = regexp.MustCompile(`(?i)\b(?:sqlmap|nikto|nuclei|acunetix|netsparker|nessus|masscan|zgrab|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|wpscan|havij|commix)\b`)
	canaryPathsRe = regexp.MustCompile(
		`(?i)(?:^\/(?:\.env(?:\..*)?|\.git(?:\/.*)?|\.aws\b|\.ssh\b|wp-admin|wp-login\.php|` +
			`xmlrpc\.php|phpmyadmin|adminer\.php|actuator\b|swagger-ui|api-docs|\.DS_Store|` +
			`web\.config|server-status))`,
	)
)

func safeUrlDecode(raw string) string {
	if !strings.ContainsAny(raw, "%+") {
		return raw
	}
	decoded, err := url.QueryUnescape(raw)
	if err != nil {
		return raw
	}
	if !strings.ContainsAny(decoded, "%+") {
		return decoded
	}
	second, err := url.QueryUnescape(decoded)
	if err != nil {
		return decoded
	}
	return second
}

func InspectPayload(pathname, search, userAgent, referer, body string) WafInspectionResult {
	if m := canaryPathsRe.FindString(pathname); m != "" {
		return WafInspectionResult{
			Matched:   true,
			Category:  "scanner",
			Points:    100,
			Signature: "AI & Recon Canary: " + m,
		}
	}

	if userAgent != "" {
		if m := scannerUaRe.FindString(userAgent); m != "" {
			return WafInspectionResult{
				Matched:   true,
				Category:  "scanner",
				Points:    80,
				Signature: "Scanner UA: " + m,
			}
		}
	}

	decPath := safeUrlDecode(pathname)
	decSearch := safeUrlDecode(search)
	decBody := safeUrlDecode(body)

	rawTarget := pathname + search
	var decodedTarget string
	if decPath == pathname && decSearch == search && body == "" {
		decodedTarget = rawTarget
	} else {
		decodedTarget = decPath + " " + decSearch
		if decBody != "" {
			decodedTarget += " " + decBody
		}
	}

	if cmdInjectionRe.MatchString(decodedTarget) ||
		(userAgent != "" && cmdInjectionRe.MatchString(userAgent)) ||
		(referer != "" && cmdInjectionRe.MatchString(referer)) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "cmd_injection",
			Points:    80,
			Signature: "Command Injection / JNDI probe",
		}
	}

	if sstiQueryRe.MatchString(decodedTarget) ||
		(decodedTarget != rawTarget && sstiQueryRe.MatchString(rawTarget)) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "cmd_injection",
			Points:    80,
			Signature: "Server-Side Template Injection (SSTI) probe",
		}
	}

	if protoPollutionRe.MatchString(rawTarget) ||
		(decodedTarget != rawTarget && protoPollutionRe.MatchString(decodedTarget)) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "cmd_injection",
			Points:    75,
			Signature: "Prototype Pollution probe",
		}
	}

	if pathTraversalRe.MatchString(rawTarget) ||
		(decodedTarget != rawTarget && pathTraversalRe.MatchString(decodedTarget)) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "path_traversal",
			Points:    70,
			Signature: "Path Traversal / LFI probe",
		}
	}

	if sqliQueryRe.MatchString(decodedTarget) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "sqli",
			Points:    65,
			Signature: "SQL Injection query signature",
		}
	}

	if xssQueryRe.MatchString(decodedTarget) {
		return WafInspectionResult{
			Matched:   true,
			Category:  "xss",
			Points:    55,
			Signature: "Reflected XSS query signature",
		}
	}

	return WafInspectionResult{Matched: false, Points: 0}
}
