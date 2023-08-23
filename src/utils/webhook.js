const WebhookSubs = require('../models/webhookSub');
const client = require('../discord/client');

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

        // Loop through each subscribed channel
        for (const matchingSub of matchingSubs) {
            const channelId = matchingSub.channelId;
            let messageContent;

            // Check the origin and create the message content accordingly
            switch (data.origin) {
                case "overseer":
                    messageContent = `${data.event}\n${data.subject}\n${data.image}`;
                    await pingChannel(channelId, messageContent);
                    break;
                case "cve-aggregator":
                    // Loop through each CVE entry in data.content
                    for (const cve of data.content) {
                        messageContent = `\n.-\n**CVE ID:** ${cve.CVE_ID}\n**Published Date:** ${cve.Published_Date}\n**Last Modified Date:** ${cve.Last_Modified_Date}\n**Description:** ${cve.Description}\n.-\n`;messageContent = `\`\`\`\nCVE ID: ${cve.CVE_ID}\nPublished Date: ${cve.Published_Date}\nLast Modified Date: ${cve.Last_Modified_Date}\nDescription: ${cve.Description}\n\`\`\``;
                        await pingChannel(channelId, messageContent);
                    }
                    break;
                default:
                    messageContent = data.subject || "Unknown subject";
                    await pingChannel(channelId, messageContent);
                    break;
            }
        }
    } else {
        console.log(`No subscription found for origin: ${data.origin}`);

        // If the incoming webhook has an origin, add a default entry
        if (data.origin) {
            const newSubscription = new WebhookSubs({
                origin: data.origin,
                channelId: 666,  // default channelId
                // Any other fields you want to store
            });

            await newSubscription.save();
            console.log(`Added a default subscription for origin: ${data.origin}`);
        }

        return null;
    }
}

async function pingChannel(channelId, message) {
    try {
        // Fetch the channel by its ID
        const channel = await client.channels.fetch(channelId);
        if (!channel || channel == "666") {
            console.error(`Channel with ID ${channelId} does not exist.`);
            return;
        }
        // Send a message with an '@everyone' ping and your provided message.
        await channel.send(`${message}`);
        console.log(`Sent a ping in channel ${channelId}: ${message}`);
    } catch (error) {
        console.error(`Error pinging everyone in channel ${channelId}: ${error}`);
    }
}

module.exports = {
    loadWebhookSubs,
    processWebhook
}