import { Env } from "./types";
import { runWorkflow } from "./workflow";

export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);

		if (url.pathname === '/trigger') {
			try {
				const ticker = url.searchParams.get('ticker') || undefined;
				const messageSent = await runWorkflow(env, 'Manual HTTP request (/trigger)', ticker);
				return new Response(JSON.stringify({
					success: true,
					message: "Workflow executed manually and Telegram message sent!",
					details: JSON.parse(messageSent)
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

		return new Response(
			`Welcome to the Cloudflare Worker Telegram Form4API & Finnhub Insider Opportunities Pipeline!\n\n` +
			`To trigger the workflow manually and send a message to Telegram, visit:\n` +
			`- General pipeline: ${url.origin}/trigger\n` +
			`- Specific ticker analysis (e.g. Apple): ${url.origin}/trigger?ticker=AAPL\n\n` +
			`Alternatively, you can test the scheduled (cron) handler locally with wrangler using "--test-scheduled".`,
			{ status: 200 }
		);
	},

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
