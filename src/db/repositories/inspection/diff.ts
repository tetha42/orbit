import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FimDiffResult } from './types';

const ROOT_DIR = process.cwd();

export async function getFimFileDiff(targetFilePath: string): Promise<FimDiffResult> {
	try {
		const rawPath = String(targetFilePath || '').trim();
		const normalizedRel = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
		const resolved = resolve(/*turbopackIgnore: true*/ ROOT_DIR, normalizedRel);
		if (!resolved.startsWith(ROOT_DIR)) {
			return {
				path: rawPath,
				type: 'deleted',
				diff: '',
				oldContent: '',
				newContent: '',
			};
		}

		const relPath = resolved.slice(ROOT_DIR.length + 1).replace(/\\/g, '/');

		let originalContent = '';
		let hasGitBaseline = false;
		try {
			const gitShow = execFileSync('git', ['show', `HEAD:${relPath}`], {
				cwd: ROOT_DIR,
				encoding: 'utf-8',
				maxBuffer: 2 * 1024 * 1024,
				stdio: ['ignore', 'pipe'],
			});
			originalContent = gitShow;
			hasGitBaseline = true;
		} catch {
			originalContent = '';
			hasGitBaseline = false;
		}

		let currentContent = '';
		let fileExistsOnDisk = false;
		if (existsSync(resolved)) {
			try {
				const buf = readFileSync(resolved);
				if (buf.length < 2 * 1024 * 1024) {
					currentContent = buf.toString('utf-8');
					fileExistsOnDisk = true;
				} else {
					currentContent = '[File size exceeds diff preview limit of 2MB]';
					fileExistsOnDisk = true;
				}
			} catch {
				fileExistsOnDisk = false;
			}
		}

		let diff = '';
		try {
			if (hasGitBaseline) {
				const gitDiff = execFileSync('git', ['diff', 'HEAD', '--', relPath], {
					cwd: ROOT_DIR,
					encoding: 'utf-8',
					maxBuffer: 2 * 1024 * 1024,
					stdio: ['ignore', 'pipe'],
				});
				diff = gitDiff;
			}
		} catch {
			// ignore git diff failure
		}

		let type: 'modified' | 'added' | 'deleted' = 'modified';
		if (!hasGitBaseline && fileExistsOnDisk) {
			type = 'added';
			if (!diff) {
				diff = currentContent
					.split('\n')
					.slice(0, 500)
					.map((line) => `+ ${line}`)
					.join('\n');
			}
		} else if (hasGitBaseline && !fileExistsOnDisk) {
			type = 'deleted';
			if (!diff) {
				diff = originalContent
					.split('\n')
					.slice(0, 500)
					.map((line) => `- ${line}`)
					.join('\n');
			}
		}

		return {
			path: relPath,
			type,
			oldContent: originalContent.slice(0, 100_000),
			newContent: currentContent.slice(0, 100_000),
			diff: diff.slice(0, 100_000),
		};
	} catch {
		return {
			path: targetFilePath,
			type: 'deleted',
			diff: '',
			oldContent: '',
			newContent: '',
		};
	}
}
