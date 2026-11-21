package main

import (
	"runtime"
	"sync/atomic"
	"time"
)

type TelemetryCollector struct {
	startTime      time.Time
	wafInspects    uint64
	wafThreats     uint64
	fimScans       uint64
}

type TelemetryMetrics struct {
	UptimeSeconds uint64 `json:"uptimeSeconds"`
	WafInspects   uint64 `json:"wafInspects"`
	WafThreats    uint64 `json:"wafThreats"`
	FimScans      uint64 `json:"fimScans"`
	GoRoutines    int    `json:"goRoutines"`
	MemoryAllocMb float64 `json:"memoryAllocMb"`
	MemorySysMb   float64 `json:"memorySysMb"`
}

func NewTelemetryCollector() *TelemetryCollector {
	return &TelemetryCollector{
		startTime: time.Now(),
	}
}

func (tc *TelemetryCollector) IncrWafInspect(threat bool) {
	atomic.AddUint64(&tc.wafInspects, 1)
	if threat {
		atomic.AddUint64(&tc.wafThreats, 1)
	}
}

func (tc *TelemetryCollector) IncrFimScan() {
	atomic.AddUint64(&tc.fimScans, 1)
}

func (tc *TelemetryCollector) GetMetrics() TelemetryMetrics {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return TelemetryMetrics{
		UptimeSeconds: uint64(time.Since(tc.startTime).Seconds()),
		WafInspects:   atomic.LoadUint64(&tc.wafInspects),
		WafThreats:    atomic.LoadUint64(&tc.wafThreats),
		FimScans:      atomic.LoadUint64(&tc.fimScans),
		GoRoutines:    runtime.NumGoroutine(),
		MemoryAllocMb: float64(m.Alloc) / 1024 / 1024,
		MemorySysMb:   float64(m.Sys) / 1024 / 1024,
	}
}
