export type WafCategory = 'sqli' | 'xss' | 'path_traversal' | 'cmd_injection' | 'scanner';

export interface WafInspectionResult {
	matched: boolean;
	category?: WafCategory;
	points: number;
	signature?: string;
}

export const PATH_TRAVERSAL_RE =
	/(?:\.\.[/\\]|%2e%2e(?:%2f|%5c|[/\\])|\/etc\/(?:passwd|shadow|hosts)|\/proc\/self\/|(?:c:|\\windows)\\system32)/i;

export const SQLI_QUERY_RE = new RegExp(
	[
		'\\bunion\\s+(?:all\\s+)?select\\b',
		'\\bselect\\b[\\s\\S]{1,40}\\bfrom\\s+(?:information_schema|pg_shadow|pg_user|pg_catalog)\\b',
		'(?:\'|"|%27|%22)\\s*(?:or|and)\\s*(?:\'[^\']*\'\\s*=\\s*\'[^\']*\'|"[^"]*"\\s*=\\s*"[^"]*"|\\b\\d+\\s*=\\s*\\d+\\b)',
		'\\bpg_sleep\\s*\\(',
		'\\bwaitfor\\s+delay\\b',
		'\\bbenchmark\\s*\\(\\s*\\d+',
	].join('|'),
	'i'
);

export const XSS_QUERY_RE =
	/(?:<\s*script\b|javascript\s*:|on(?:error|load|mouseover|focus)\s*=\s*[^\s>]+|<\s*(?:iframe|svg|img)\b[^>]*\bon\w+\s*=)/i;

export const CMD_INJECTION_RE =
	/(?:\$\{jndi:(?:ldap|rmi|dns|nis|iiop|corba|nds|http):|[;|`]\s*(?:cat|ls|whoami|id|uname|curl|wget|bash|sh|nc|ncat)\b|\$\(\s*(?:whoami|id|uname|cat|curl|wget)\b)/i;

export const SSTI_QUERY_RE =
	/(?:\{\{\s*(?:\d+\s*[\*+-/]\s*\d+|config|request|app|self|lipsum|cycler|joiner|process|mainModule)\s*\}\}|\$\{\s*(?:\d+\s*[\*+-/]\s*\d+|process|mainModule)\s*\}|<%.*?%>)/i;

export const PROTOTYPE_POLLUTION_RE =
	/(?:__proto__|constructor\s*(?:\.|\s*\[\s*['"]?)\s*prototype|\bprototype\b\s*(?:\.\s*\w+|\[))/i;

export const OFFENSIVE_SCANNER_UA_RE =
	/\b(?:sqlmap|nikto|nuclei|acunetix|netsparker|nessus|masscan|zgrab|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|wpscan|havij|commix)\b/i;

export const AI_RECON_CANARY_PATHS_RE = new RegExp(
	'^\\/(?:\\.env(?:\\..*)?|\\.git(?:\\/.*)?|\\.aws\\b|\\.ssh\\b|' +
		'wp-admin|wp-login\\.php|xmlrpc\\.php|phpmyadmin|adminer\\.php|' +
		'actuator\\b|swagger-ui|api-docs|\\.DS_Store|web\\.config|server-status)',
	'i'
);
