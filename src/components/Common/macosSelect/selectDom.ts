export interface ParsedSelectItem {
	type: 'option' | 'group' | 'separator';
	value?: string;
	label: string;
	disabled?: boolean;
	selected?: boolean;
	optionIndex?: number;
}

export interface SelectPopupCoords {
	top?: number;
	bottom?: number;
	left: number;
	width: number;
	maxHeight: number;
}

export function parseSelectChildren(selectEl: HTMLSelectElement): ParsedSelectItem[] {
	const items: ParsedSelectItem[] = [];
	const currentVal = selectEl.value;
	let optCounter = 0;

	Array.from(selectEl.children).forEach((child, childIdx) => {
		if (child.tagName === 'OPTGROUP') {
			const group = child as HTMLOptGroupElement;
			if (items.length > 0) {
				items.push({ type: 'separator', label: `sep-${childIdx}` });
			}
			if (group.label) {
				items.push({ type: 'group', label: group.label });
			}
			Array.from(group.children).forEach((optChild) => {
				if (optChild.tagName === 'OPTION') {
					const opt = optChild as HTMLOptionElement;
					const idx = optCounter++;
					items.push({
						type: 'option',
						value: opt.value,
						label: opt.label || opt.textContent || '',
						disabled: opt.disabled || group.disabled,
						selected: opt.value === currentVal && selectEl.selectedIndex === idx,
						optionIndex: idx,
					});
				}
			});
		} else if (child.tagName === 'OPTION') {
			const opt = child as HTMLOptionElement;
			const idx = optCounter++;
			items.push({
				type: 'option',
				value: opt.value,
				label: opt.label || opt.textContent || '',
				disabled: opt.disabled,
				selected: opt.value === currentVal && (selectEl.selectedIndex === idx || selectEl.selectedIndex === -1),
				optionIndex: idx,
			});
		}
	});

	return items;
}

export function setReactSelectValue(selectEl: HTMLSelectElement, nextValue: string, optionIndex?: number) {
	const proto = HTMLSelectElement.prototype;
	const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
	const tracker = (selectEl as HTMLSelectElement & { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
	if (tracker) {
		tracker.setValue(selectEl.value);
	}
	if (typeof optionIndex === 'number' && optionIndex >= 0) {
		selectEl.selectedIndex = optionIndex;
	}
	if (descriptor?.set) {
		descriptor.set.call(selectEl, nextValue);
	} else {
		selectEl.value = nextValue;
	}
	selectEl.dispatchEvent(new Event('input', { bubbles: true }));
	selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

export function computeSelectCoords(rect: DOMRect, itemCount: number): SelectPopupCoords {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = Math.max(rect.width, 180);
	const left = Math.max(8, Math.min(rect.left, vw - width - 8));

	const spaceBelow = vh - rect.bottom - 12;
	const spaceAbove = rect.top - 36;
	const estimatedHeight = Math.min(300, itemCount * 28 + 12);

	if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
		return {
			bottom: vh - rect.top + 5,
			left,
			width,
			maxHeight: Math.max(120, Math.min(300, spaceAbove)),
		};
	}

	return {
		top: rect.bottom + 5,
		left,
		width,
		maxHeight: Math.max(120, Math.min(300, spaceBelow)),
	};
}
