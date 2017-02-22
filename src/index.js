const APP_ID = undefined; //eslint-disable-line
const AWS = require('aws-sdk');
import Promise from 'bluebird';

function sendMessage ({action, response}) {
  const duration = this.computeDuration(action);
  const durationString = `${duration.humanize()} from now`;

  const done = `Your reminder to ${action.reminder} is set for ${durationString}.`;
  const params = {
    Message: `RemindMe: "${action.reminder}" for ${durationString} from now.`,
    PhoneNumber: '+17408565809'
  };
  const sns = new AWS.SNS();
  sns.publish(params, function (err, data) {
    if (err) {
      console.log(err);
      response.tell('Sorry, sending the reminder failed.');
    } else {
      response.tell(done);
    }
  });
}

function processReminder (reminder) {
  console.log(`processing reminder`, reminder);
  return Promise.resolve();
}

function processReminders (reminders) {
  if (!reminders.Messages || reminders.Messages.length === 0) {
    console.log(`No pending reminders to process`);
    return []; // empty array of promises
  }
  console.log(`processing ${reminders.Messages.length} pending reminders`);

  // map each item to a promise
  return reminders.Messages.map((message) => {
    return processReminder(message);
  });
}

function getPendingReminders () {
  const sqs = new AWS.SQS();
  const queueURL = 'https://sqs.us-east-1.amazonaws.com/920018820316/remindMeReminders';

  const params = {
    AttributeNames: [
      'SentTimestamp'
    ],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: [
      'All'
    ],
    QueueUrl: queueURL,
    VisibilityTimeout: 0,
    WaitTimeSeconds: 0
  };

  return Promise.fromCallback(callback => sqs.receiveMessage(params, callback));

//   sqs.receiveMessage(params, function (err, data) {
//     if (err) {
//       console.log('error receiving messages from sqs', err);
//     } else {
//       var deleteParams = {
//         QueueUrl: queueURL,
//         ReceiptHandle: data.Messages[0].ReceiptHandle
//       };
//       // sqs.deleteMessage(deleteParams, function (err, data) {
//       //   if (err) {
//       //     console.log('error deleting messages from sqs', err);
//       //   } else {
//       //     console.log('deleted message from sqs', data);
//       //   }
//       // });
//     }
//   });
}

function processQueue () {
  return getPendingReminders()
    .then((reminders) => {
      console.log('Fetched queued reminders', reminders);
      processReminders(reminders);
    });
}

exports.handler = function (event, context) {
  processQueue();
};

exports.processQueue = processQueue;
