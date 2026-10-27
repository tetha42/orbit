import React from 'react';

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

/** Plain text with http(s) links made clickable — nothing else is interpreted, so no markup can be injected. */
export function Linkified({ text }: { text: string }) {
	const parts = text.split(URL_RE);
	return (
		<>
			{parts.map((part, i) =>
				i % 2 === 1 ? (
					<a key={i} href={part} target="_blank" rel="noreferrer noopener">
						{part}
					</a>
				) : (
					<React.Fragment key={i}>{part}</React.Fragment>
				)
			)}
		</>
	);
}
