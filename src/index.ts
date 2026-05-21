import { Form4ApiClient } from "form4api";

export interface Env {
	ENV: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	FORM4_API_KEY: string;
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
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

async function runWorkflow(env: Env, triggerType: string, ticker?: string): Promise<string> {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID configuration.");
	}
	if (!env.FORM4_API_KEY) {
		throw new Error("Missing FORM4_API_KEY configuration.");
	}

	const client = new Form4ApiClient({ apiKey: env.FORM4_API_KEY });

	console.log(`Fetching insider transactions from Form4API... (Ticker filter: ${ticker || "none"})`);

	// Fetch recent insider purchases and filter to open-market in-memory
	const rawTxns = await client.transactions.list({
		ticker: ticker || undefined,
		code: "P",
		perPage: 15
	});

	const txns = rawTxns.filter(txn => txn.isOpenMarket).slice(0, 5);

	let message = `🤖 <b>Form4API Insider Purchases Alert</b>\n` +
		`• <b>Trigger:</b> ${triggerType}\n` +
		`• <b>Date/Time:</b> ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n\n`;

	if (txns.length === 0) {
		message += `❌ No recent insider purchases found${ticker ? ` for ticker <b>${ticker}</b>` : ""}.`;
	} else {
		message += `🚨 <b>Recent Insider Purchases:</b>\n\n`;
		for (const txn of txns) {
			const formattedValue = txn.totalValue
				? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(txn.totalValue)
				: 'N/A';
			const formattedPrice = txn.pricePerShare
				? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(txn.pricePerShare)
				: 'N/A';

			const role = txn.isDirector ? "Director" : txn.isOfficer ? `Officer (${txn.insiderTitle || "N/A"})` : "10% Owner";

			message += `📈 <b>${txn.ticker}</b> (${txn.companyName})\n` +
				`👤 <b>Insider:</b> ${txn.insiderName} (${role})\n` +
				`💼 <b>Shares:</b> ${txn.sharesAmount.toLocaleString()} @ ${formattedPrice}\n` +
				`💰 <b>Total Value:</b> ${formattedValue}\n` +
				`📅 <b>Date:</b> ${txn.transactionDate.split('T')[0]}\n\n`;
		}
	}

	await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);
	return message;
}

export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);

		// Allow manual triggering via GET /trigger
		if (url.pathname === '/trigger') {
			try {
				const ticker = url.searchParams.get('ticker') || undefined;
				const messageSent = await runWorkflow(env, 'Manual HTTP request (/trigger)', ticker);
				return new Response(JSON.stringify({
					success: true,
					message: "Workflow executed manually and Telegram message sent!",
					details: messageSent
				}, null, 2), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error: any) {
				return new Response(JSON.stringify({
					success: false,
					error: error.message
				}, null, 2), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Default response
		return new Response(
			`Welcome to the Cloudflare Worker Telegram Form4API test!\n\n` +
			`To trigger the workflow manually and send a message to Telegram, visit:\n` +
			`- General purchases: ${url.origin}/trigger\n` +
			`- Specific ticker purchases (e.g. Apple): ${url.origin}/trigger?ticker=AAPL\n\n` +
			`Alternatively, you can test the scheduled (cron) handler locally with wrangler using "--test-scheduled".`,
			{ status: 200 }
		);
	},

	// The scheduled handler is invoked at the interval set in wrangler.jsonc
	async scheduled(event, env, ctx): Promise<void> {
		try {
			console.log(`Cron trigger fired at ${event.cron}. Running workflow...`);
			await runWorkflow(env, `Cron Trigger (${event.cron})`);
			console.log(`Workflow ran successfully and Telegram message sent.`);
		} catch (error: any) {
			console.error(`Error running cron workflow: ${error.message}`);
		}
	},
} satisfies ExportedHandler<Env>;


