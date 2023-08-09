const schedule = require('node-schedule');
const moment = require('moment-timezone');
const ScheduledEvent = require('../models/scheduledEvent');
const cronstrue = require('cronstrue');

// Dictionary to hold jobs by an ID
const jobs = {};

async function loadJobsFromDatabase(client) {
    const events = await ScheduledEvent.find({});
    console.log(`Loaded ${events.length} events from the database.`);
    // Current time for comparison
    const now = moment();

    // Iterate through events and validate each one
    for (const event of events) {
        const { eventName, time, frequency, timezone } = event;
        const date = time.split('T')[0];
        const timePart = time.split('T')[1];

        /*         // Check if any field is undefined
                if (!eventName || !date || !timePart || !frequency || !timezone) {
                    console.log(`Removing invalid event with missing field(s): ${eventName}`);
                    await ScheduledEvent.deleteOne({ _id: event._id });
                    continue;
                } */

        // Check if the date/time is past now
        // Check if the date/time is past now
        const eventTime = moment.tz(`${date}T${timePart}`, "YYYY-MM-DDTHH:mm:ss", timezone);
        if (eventTime.isBefore(now)) {
            console.log(`Removing expired event: ${eventName}`);
            await ScheduledEvent.deleteOne({ _id: event._id });
            continue;
        }

        // Schedule the event if it's valid, without saving to the database
        scheduleEvent(event, event.channelId, client, false);
    }
}

async function pingEveryone(channelId, messageContent, eventTime, frequency, client) {
    try {
        const channel = await client.channels.fetch(channelId);
        const now = moment();
        const duration = moment.duration(eventTime.diff(now));
        const timeRemaining = [
            duration.years() > 0 ? duration.years() + ' years' : null,
            duration.days() > 0 ? duration.days() + ' days' : null,
            duration.hours() > 0 ? duration.hours() + ' hours' : null,
            duration.minutes() > 0 ? duration.minutes() + ' minutes' : null,
        ].filter(Boolean).join(', ');
        const humanReadableFrequency = frequency ? cronstrue.toString(frequency) : null;
        const fullMessage = `@everyone ${messageContent} (Time Remaining: ${timeRemaining}${humanReadableFrequency ? `, Frequency: ${humanReadableFrequency}` : ''})`;
        console.log(`Pinging everyone in channel ${channelId}: ${fullMessage}`);
        channel.send(fullMessage);
    } catch (error) {
        console.error(`Error pinging everyone in channel ${channelId}: ${error}`);
    }
}

async function scheduleEvent(eventData, channelId, client, saveToDatabase = true) {
    if (!eventData || !channelId || !client) {
        console.error('Invalid data provided for scheduling the event.');
        return;
    }

    // Read the eventName, frequency, timezone properties from eventData
    const eventName = eventData.eventName;
    const date = eventData.time.split('T')[0];
    const timePart = eventData.time.split('T')[1];
    const frequency = eventData.frequency;
    const timezone = eventData.timezone;

    // Combine Date and Time into a single ISO string, then convert to the specified timezone
    const eventTime = moment.tz(`${date}T${timePart}`, "YYYY-MM-DDTHH:mm:ss", timezone);
    if (!eventTime.isValid()) {
        console.error("Invalid date or time provided.");
        return;
    }

    const formattedTimezone = eventTime.format('z');
    const formattedTime = eventTime.format(`MMMM D, YYYY [at] h:mm A [${formattedTimezone || timezone}]`);
    if (saveToDatabase) {
        await pingEveryone(channelId, `Scheduling event: ${eventName} on ${formattedTime}`, eventTime, frequency, client);
    }

    // Schedule a recurring job based on the cron string
    const reminderJob = schedule.scheduleJob(frequency, async () => {
        await pingEveryone(channelId, `Reminder for event: ${eventName} on ${formattedTime}`, eventTime, frequency, client);
    });

    if (!reminderJob) {
        console.error('Failed to schedule the reminder job.');
        return;
    }

    // Generate a unique ID for the job
    const jobId = `${eventName}-${date}-${timePart}`;
    jobs[jobId] = reminderJob;

    // Schedule the cancellation of the reminder job at the specified time
    schedule.scheduleJob(eventTime.toDate(), async () => {
        console.log(`Cancelling reminders for event: ${eventName}`);
        cancelJob(jobId);
        await ScheduledEvent.deleteOne({ eventName: eventName });
    });

    // Only save the event to the database if saveToDatabase is true
    if (saveToDatabase) {
        // Saving the event to the database
        const newEvent = new ScheduledEvent({
            eventName,
            channelId,
            frequency,
            time: `${date}T${timePart}`,
            timezone
        });
        await newEvent.save();
    }

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
