const schedule = require('node-schedule');
const moment = require('moment-timezone');

async function loadJobsFromDatabase(client) {
    const jobs = await Job.find({});
    jobs.forEach(job => {
      scheduleEvent(job, job.channelId, client);
    });
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
    const { 'Event Name': eventName, Date, Time, Frequency, Timezone } = eventData;

    // Combine Date and Time into a single ISO string, then convert to the specified timezone
    const eventTime = moment.tz(`${Date}T${Time}`, Timezone);
    const formattedTimezone = eventTime.format('z');
    const formattedTime = eventTime.format(`MMMM D, YYYY [at] h:mm A [${formattedTimezone || Timezone}]`); // Format including timezone abbreviation


    await pingEveryone(channelId, `Scheduling event: ${eventName} on ${formattedTime}`, client);

    // Schedule a recurring job based on the cron string
    const reminderJob = schedule.scheduleJob(Frequency, async () => {
        await pingEveryone(channelId, `Reminder for event: ${eventName} on ${formattedTime}`, client);
    });

    // Schedule the cancellation of the reminder job at the specified Time
    schedule.scheduleJob(eventTime.toDate(), () => {
        console.log(`Cancelling reminders for event: ${eventName}`);
        reminderJob.cancel();
    });

    console.log(`Scheduled recurring reminder for event: ${eventName}`);
    return eventName;
}

module.exports = {
    scheduleEvent
}
