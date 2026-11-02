'use client';

import { MenuItem } from '@/types/workspace';
import { MacOSMenu } from '@/components/Common/MacOSMenu';

interface MenuDropdownProps {
	items: MenuItem[];
	onClose: () => void;
}

export function MenuDropdown({ items, onClose }: MenuDropdownProps) {
	return (
		<div
			style={{
				position: 'absolute',
				top: '26px',
				left: 0,
				zIndex: 9999,
			}}
		>
			<MacOSMenu items={items} onClose={onClose} style={{ minWidth: '220px' }} />
		</div>
	);
}
