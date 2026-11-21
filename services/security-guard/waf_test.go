package main

import "testing"

func TestInspectPayload(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		search   string
		ua       string
		ref      string
		body     string
		expected bool
	}{
		{
			name:     "Clean request",
			path:     "/api/events",
			search:   "?limit=10",
			ua:       "Mozilla/5.0",
			expected: false,
		},
		{
			name:     "SQLi probe",
			path:     "/api/events",
			search:   "?id=1' OR 1=1--",
			expected: true,
		},
		{
			name:     "XSS attack",
			path:     "/search",
			search:   "?q=<script>alert(1)</script>",
			expected: true,
		},
		{
			name:     "Command injection",
			path:     "/ping",
			search:   "?host=127.0.0.1; cat /etc/passwd",
			expected: true,
		},
		{
			name:     "Path traversal",
			path:     "/download",
			search:   "?file=../../etc/shadow",
			expected: true,
		},
		{
			name:     "Canary path probe",
			path:     "/.env",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := InspectPayload(tt.path, tt.search, tt.ua, tt.ref, tt.body)
			if res.Matched != tt.expected {
				t.Fatalf("expected matched=%v, got %v (signature: %s)", tt.expected, res.Matched, res.Signature)
			}
		})
	}
}
