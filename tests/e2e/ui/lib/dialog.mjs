// The portal's own confirm/alert dialog (components/Common/DialogProvider): [role=alertdialog].
// The confirm button is the last one in the row; the cancel button is the first of a two-button confirm.

/** The dialog on screen, once it is there. */
export async function dialogShow(page) {
	const dlg = page.locator('[role=alertdialog]');
	await dlg.waitFor();
	return dlg;
}

/** Waits for the dialog, returns what it says, and answers it: `ok` confirms, otherwise cancels. */
export async function dialogReply(page, ok = true) {
	const dlg = await dialogShow(page);
	const text = (await dlg.innerText()).replace(/\s+/g, ' ').trim();
	const buttons = dlg.locator('.dlg-actions button');
	await (ok ? buttons.last() : buttons.first()).click();
	await dlg.waitFor({ state: 'detached' });
	return text;
}
