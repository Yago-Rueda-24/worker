export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<any> {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			chat_id: chatId,
			text: text,
			parse_mode: 'HTML',
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Telegram API error (${response.status}): ${errorText}`);
	}

	return await response.json();
}
