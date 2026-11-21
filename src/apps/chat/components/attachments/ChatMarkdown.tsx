'use client';

import React from 'react';
import s from '../../ChatAttachments.module.css';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let index = 0;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
		const token = match[0];
		if (token.startsWith('**')) {
			nodes.push(<strong key={`${keyPrefix}-b-${index++}`}>{token.slice(2, -2)}</strong>);
		} else if (token.startsWith('*')) {
			nodes.push(<em key={`${keyPrefix}-i-${index++}`}>{token.slice(1, -1)}</em>);
		} else if (token.startsWith('`')) {
			nodes.push(
				<code key={`${keyPrefix}-c-${index++}`} className={s.markdownCode}>
					{token.slice(1, -1)}
				</code>
			);
		} else {
			const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
			if (link) {
				nodes.push(
					<a
						key={`${keyPrefix}-a-${index++}`}
						href={link[2]}
						target="_blank"
						rel="noreferrer noopener"
						className={s.markdownLink}
					>
						{link[1]}
					</a>
				);
			} else {
				nodes.push(token);
			}
		}
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
}

/** Safe Markdown subset for chat attachments (headings, lists, quotes, inline styles). */
export function ChatMarkdown({ source }: { source: string }) {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const blocks: React.ReactNode[] = [];
	let list: string[] = [];
	let code: string[] | null = null;

	const flushList = () => {
		if (list.length === 0) return;
		blocks.push(
			<ul key={`list-${blocks.length}`} className={s.markdownList}>
				{list.map((item, index) => (
					<li key={index}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>
				))}
			</ul>
		);
		list = [];
	};

	for (const [index, line] of lines.entries()) {
		if (line.trim().startsWith('```')) {
			if (code) {
				blocks.push(
					<pre key={`pre-${blocks.length}`} className={s.markdownPre}>
						<code>{code.join('\n')}</code>
					</pre>
				);
				code = null;
			} else {
				flushList();
				code = [];
			}
			continue;
		}
		if (code) {
			code.push(line);
			continue;
		}
		if (/^#{1,3}\s/.test(line)) {
			flushList();
			const level = line.match(/^#+/)?.[0].length ?? 1;
			const text = line.replace(/^#+\s*/, '');
			const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
			blocks.push(
				React.createElement(
					Tag,
					{ key: `h-${index}`, className: s.markdownHeading },
					renderInline(text, `h-${index}`)
				)
			);
			continue;
		}
		if (/^\s*[-*]\s+/.test(line)) {
			list.push(line.replace(/^\s*[-*]\s+/, ''));
			continue;
		}
		if (line.startsWith('> ')) {
			flushList();
			blocks.push(
				<blockquote key={`q-${index}`} className={s.markdownQuote}>
					{renderInline(line.slice(2), `q-${index}`)}
				</blockquote>
			);
			continue;
		}
		if (!line.trim()) {
			flushList();
			continue;
		}
		flushList();
		blocks.push(
			<p key={`p-${index}`} className={s.markdownParagraph}>
				{renderInline(line, `p-${index}`)}
			</p>
		);
	}
	if (code) {
		blocks.push(
			<pre key={`pre-${blocks.length}`} className={s.markdownPre}>
				<code>{code.join('\n')}</code>
			</pre>
		);
	}
	flushList();
	return <div className={s.markdownBody}>{blocks}</div>;
}
