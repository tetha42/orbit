# Multi-stage build for Orbit Go Security Guard Microservice
FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY services/security-guard/go.mod ./
COPY services/security-guard/*.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/security-guard .

FROM alpine:3.21

RUN apk --no-cache add ca-certificates wget

WORKDIR /app

RUN mkdir -p /app/state /app/data/uploads /app/data/custom && chown -R nobody:nobody /app/state

COPY --from=builder /bin/security-guard /usr/local/bin/security-guard

ENV PORT=8080
ENV ORBIT_ROOT=/app

EXPOSE 8080

USER nobody:nobody

CMD ["/usr/local/bin/security-guard"]
