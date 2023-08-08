const schedule = require('node-schedule');
const moment = require('moment-timezone');
const ScheduledEvent = require('../models/scheduledEvent');

// Dictionary to hold jobs by an ID
const jobs = {};

async function loadJobsFromDatabase(client) {
    const events = await ScheduledEvent.find({});

    // Current time for comparison
    const now = moment();

    // Iterate through events and validate each one
    for (const event of events) {
        const { eventName: eventName, time, frequency: Frequency, timezone: Timezone } = event;
        const [Date, Time] = time.split('T'); // Split the 'time' field into Date and Time parts

        // Check if any field is undefined
        if (!eventName || !Date || !Time || !Frequency || !Timezone) {
            console.log(`Removing invalid event with missing field(s): ${eventName}`);
            await ScheduledEvent.deleteOne({ _id: event._id });
            continue;
        }

        // Check if the date/time is past now
        const eventTime = moment.tz(`${Date}T${Time}`, Timezone);
        if (eventTime.isBefore(now)) {
            console.log(`Removing expired event: ${eventName}`);
            await ScheduledEvent.deleteOne({ _id: event._id });
            continue;
        }

        // Schedule the event if it's valid
        scheduleEvent(event, event.channelId, client);
    }
}



async function pingEveryone(channelId, messageContent, client) {
    try {
        const channel = await client.channels.fetch(channelId);
        console.log(`Pinging everyone in channel ${channelId}: ${messageContent}`);
        channel.send(`@everyone ${messageContent}`);
    } catch (error) {
        console.error(`Error pinging everyone in channel ${channelId}: ${error}`);
    }
}

async function scheduleEvent(eventData, channelId, client) {
    if (!eventData || !channelId || !client) {
        console.error('Invalid data provided for scheduling the event.');
        return;
    }

    const { 'Event Name': eventName, Date, Time, Frequency, Timezone } = eventData;

    // Check for missing or undefined fields
    if (!eventName || !Date || !Time || !Frequency || !Timezone) {
        console.error("Missing or undefined fields in event data:", eventData);
        return;
    }

    // Combine Date and Time into a single ISO string, then convert to the specified timezone
    const eventTime = moment.tz(`${Date}T${Time}`, "YYYY-MM-DDTHH:mm:ss", Timezone);
    if (!eventTime.isValid()) {
        console.error("Invalid date or time provided.");
        return;
    }

    const formattedTimezone = eventTime.format('z');
    const formattedTime = eventTime.format(`MMMM D, YYYY [at] h:mm A [${formattedTimezone || Timezone}]`);
    await pingEveryone(channelId, `Scheduling event: ${eventName} on ${formattedTime}`, client);

    // Schedule a recurring job based on the cron string
    const reminderJob = schedule.scheduleJob(Frequency, async () => {
        await pingEveryone(channelId, `Reminder for event: ${eventName} on ${formattedTime}`, client);
    });

    if (!reminderJob) {
        console.error('Failed to schedule the reminder job.');
        return;
    }

    // Generate a unique ID for the job
    const jobId = `${eventName}-${Date}-${Time}`;
    jobs[jobId] = reminderJob;

    // Schedule the cancellation of the reminder job at the specified Time
    schedule.scheduleJob(eventTime.toDate(), async () => {
        console.log(`Cancelling reminders for event: ${eventName}`);
        cancelJob(jobId);
        await ScheduledEvent.deleteOne({ eventName: eventName });
    });

    // Saving the event to the database
    const newEvent = new ScheduledEvent({
        eventName,
        channelId,
        frequency: Frequency,
        time: `${Date}T${Time}`,
        timezone: Timezone
    });
    await newEvent.save();

    console.log(`Scheduled recurring reminder for event: ${eventName}`);
    return eventName;
}

function cancelJob(jobId) {
    const job = jobs[jobId];
    if (job) {
        job.cancel();
        delete jobs[jobId];
    } else {
        console.error(`Job with ID ${jobId} not found.`);
    }
}

module.exports = {
    scheduleEvent,
    loadJobsFromDatabase,
    cancelJob // Exporting the cancelJob function if needed elsewhere
}
