/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
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

async function runWorkflow(env: Env, triggerType: string): Promise<string> {
	// A Cron Trigger can make requests to other endpoints on the Internet,
	// query a D1 Database, and much more.
	let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
	let wasSuccessful = resp.ok ? 'success' : 'fail';
	let ipData = '';
	if (resp.ok) {
		const data = await resp.json() as any;
		ipData = `IPv4: ${data.result?.ipv4_cidrs?.slice(0, 3).join(', ')}...`;
	}

	const message = `🤖 <b>Worker Workflow Triggered</b>\n` +
		`• <b>Trigger Type:</b> ${triggerType}\n` +
		`• <b>Time:</b> ${new Date().toISOString()}\n` +
		`• <b>Cloudflare IPs fetch:</b> ${wasSuccessful}\n` +
		`• <b>Data preview:</b> ${ipData}`;

	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID configuration.");
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
				const messageSent = await runWorkflow(env, 'Manual HTTP request (/trigger)');
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
			`Welcome to the Cloudflare Worker Telegram test!\n\n` +
			`To trigger the workflow manually and send a message to Telegram, visit: ${url.origin}/trigger\n\n` +
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

