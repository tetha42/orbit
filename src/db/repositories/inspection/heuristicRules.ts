export interface HeuristicRuleDef {
	name: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
	pattern: RegExp;
	extensions?: string[];
}

export const PHP_EXTENSIONS = ['.php', '.phtml', '.php5', '.phar', '.inc'];
export const NODE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx'];

export const PURE_HEURISTIC_RULES: HeuristicRuleDef[] = [
	{
		name: 'PHP_EVAL_BASE64',
		severity: 'CRITICAL',
		pattern: /(?:eval\s*\(|assert\s*\(\s*["']|\$\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*|create_function\s*\(|preg_replace\s*\(\s*["'][^"']*\/e["'])/i,
		extensions: PHP_EXTENSIONS,
	},
	{
		name: 'SHELL_COMMAND_EXEC',
		severity: 'CRITICAL',
		pattern: /(?:passthru|shell_exec|system|popen|proc_open|pcntl_exec)\s*\(/i,
		extensions: PHP_EXTENSIONS,
	},
	{
		name: 'NODE_CHILD_PROCESS_EXEC',
		severity: 'CRITICAL',
		pattern: new RegExp(
			[
				'child_process\\.(?:exec|spawn|fork|execSync|spawnSync|execFile|execFileSync)\\s*\\(',
				'require\\s*\\(\\s*["\'](?:node:)?child_process["\']\\)',
				'import\\s*\\(\\s*["\'](?:node:)?child_process["\']\\)',
				'(?:exec|spawn|execFile)\\s*\\(\\s*["\'](?:\\/bin\\/(?:ba)?sh|sh|bash|cmd(?:\\.exe)?|powershell)',
			].join('|'),
			'i'
		),
		extensions: NODE_EXTENSIONS,
	},
	{
		name: 'BACKDOOR_FILE_WRITE',
		severity: 'HIGH',
		pattern: /(?:fs\.writeFileSync|fs\.writeFile|file_put_contents)\s*\([^,]+(?:\.php|\.phtml|\.phar|\.sh|\.bash|\.elf|\.exe|\.cgi)/i,
	},
	{
		name: 'REVERSE_SHELL_NET',
		severity: 'CRITICAL',
		pattern: new RegExp(
			[
				'\\/dev\\/(?:tcp|udp)\\/\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\/\\d+',
				'(?:nc|ncat|netcat)\\s+.*-[eE]\\s+',
				'(?:nc|ncat|netcat)\\s+-[eE]\\s+',
				'python(?:\\d)?\\s+-c\\s+[\'"].*(?:socket.*connect|pty\\.spawn)',
				'perl\\s+-e\\s+[\'"].*socket.*connect',
				'ruby\\s+-e\\s+[\'"].*TCPSocket',
				'mkfifo\\s+\\/tmp',
			].join('|'),
			'i'
		),
	},
	{
		name: 'POWERSHELL_OR_CURL_PIPE',
		severity: 'HIGH',
		pattern: /(?:powershell(?:\.exe)?\s+-(?:enc|encodedcommand)\s+[a-zA-Z0-9+/=]{16,}|(?:curl|wget)\s+-[sS]?\s+.*\|\s*(?:bash|sh))/i,
	},
	{
		name: 'OBFUSCATED_PAYLOAD',
		severity: 'HIGH',
		pattern: /(?:\\x[0-9a-fA-F]{2}){8,}|base64_decode\s*\(\s*['"]?[a-zA-Z0-9+/=]{24,}|(?:gzinflate|gzuncompress|gzdecode|str_rot13|hex2bin)\s*\(/i,
	},
	{
		name: 'INTERACTIVE_SHELL_SPAWN',
		severity: 'CRITICAL',
		pattern: /(?:pty\.spawn\s*\(\s*["'](?:\/bin\/)?(?:ba)?sh["']|execve\s*\(\s*["']\/bin\/(?:ba)?sh|bash\s+-i\s+>&|\/bin\/(?:ba)?sh\s+-i\s+>&)/i,
	},
];

export const SCANNABLE_EXTENSIONS = new Set([
	'.php', '.phtml', '.php5', '.phar', '.inc',
	'.sh', '.bash', '.js', '.mjs', '.cjs', '.ts', '.tsx',
	'.py', '.pl', '.rb', '.jsp', '.asp', '.aspx', '.cgi',
	'.html', '.htm', '.json', '.go',
]);
