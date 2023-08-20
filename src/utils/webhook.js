const WebhookSubs = require('../models/webhookSub');
const { pingChannel } = require('../discord/bot');

let subs = [];

async function loadWebhookSubs() {
    subs = await WebhookSubs.find({});
    console.log(`Loaded ${subs.length} Webhook Subscriptions from the database.`);
    return subs
}

async function processWebhook(data) {
    console.log(data);

    // Find all subscriptions that match the received webhook's origin
    const matchingSubs = subs.filter(sub => sub.origin === data.origin);

    if (matchingSubs.length > 0) {
        console.log(`Processing webhook for origin: ${data.origin}`);

        for (const matchingSub of matchingSubs) {
            const channelId = matchingSub.channelId;

            const messageContent = data.origin === "overseer"
                ? `${data.event}\n${data.subject}\n${data.image}`
                : data.subject;

            await pingChannel(channelId, messageContent);
        }
    } else {
        console.log(`No subscription found for origin: ${data.origin}`);
        return null;
    }
}

module.exports = {
    loadWebhookSubs,
    processWebhook
}