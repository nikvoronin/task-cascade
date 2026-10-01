import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText: string,
		private onConfirm: () => void | Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;

		this.setTitle(this.title);

		contentEl.createEl("p", {
			text: this.message,
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setDestructive()
					.setCta()
					.onClick(async () => {
						this.close();
						await this.onConfirm();
					}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}