export function generateNginxConfig(domain: string): string {
	const dom = domain.trim() || 'orbit.example.com';
	return `# Nginx Reverse Proxy Configuration for Orbit Community OS
# Place in /etc/nginx/sites-available/${dom} and symlink to sites-enabled/

server {
    listen 80;
    listen [::]:80;
    server_name ${dom};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${dom};

    # TLS Certificates (e.g. Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/${dom}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${dom}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security & HSTS Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Client upload limits for files & documents
    client_max_body_size 60M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Upgrade Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Client Identity
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ESSENTIAL FOR NEXT.JS SSE STREAMS (Chat, Telemetry, Radar)
        # Prevents Nginx from buffering and hanging realtime events
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
`;
}
