const WebhookSubs = require('../models/webhookSub');
const client = require('../discord/client');
const { generateVulnerabilityReport } = require('../openai/gpt')

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
                    let messageContents = [];
                    for (const cve of data.content.vulnerabilities) {
                        const singleMessageContent =
                            `\`\`\`CVE ID: ${cve.CVE_ID}\n Status: ${cve.Status} \n Published Date: ${cve.Published_Date} \n Last Modified Date: ${cve.Last_Modified_Date} \n Description: ${cve.Description} \n CVSS v3 Score: ${cve.CVSS_v3_Score} \n CVSS v3 Severity: ${cve.CVSS_v3_Severity} \n CVSS v2 Score: ${cve.CVSS_v2_Score} \`\`\``;

                        messageContents.push(singleMessageContent);
                    }

                    // Chunk messages if needed (Discord's limit is 2000 chars)
                    let chunkedMessage = '';
                    for (const content of messageContents) {
                        if ((chunkedMessage.length + content.length) > 1900) { // give some buffer
                            await pingChannel(channelId, chunkedMessage);
                            chunkedMessage = '';
                        }
                        chunkedMessage += content + '\n';
                    }

                    if (chunkedMessage) {
                        await pingChannel(channelId, chunkedMessage);
                    }
                    break;
                case "cve-full-report":
                    const allCVEs = data.content.vulnerabilities.map(cve => {
                        return `CVE ID: ${cve.CVE_ID}\nStatus: ${cve.Status}\nPublished Date: ${cve.Published_Date}\nLast Modified Date: ${cve.Last_Modified_Date}\nDescription: ${cve.Description}\nCVSS v3 Score: ${cve.CVSS_v3_Score}\nCVSS v3 Severity: ${cve.CVSS_v3_Severity}\nCVSS v2 Score: ${cve.CVSS_v2_Score}`;
                    }).join('\n\n');

                    const report = await generateVulnerabilityReport(allCVEs);
                    console.log("THIS IS THE REPORT, ", report)
                    await pingChannel(channelId, report)
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