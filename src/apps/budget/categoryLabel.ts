/** The label of a budget category: its translation, or the raw value for anything unknown. */
export function categoryLabel(t: (key: string, fallback?: string) => string, category: string): string {
	return t(`budgetCat_${category}`, category);
}
