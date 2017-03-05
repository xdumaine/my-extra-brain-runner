const APP_ID = undefined; //eslint-disable-line
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
import Promise from 'bluebird';
import moment from 'moment';

function sendMessage ({ phoneNumber, reminder }) {
  if (phoneNumber[0] !== '+') {
    phoneNumber = `+1${phoneNumber}`;
  }
  const params = {
    Message: `RemindMe: "${reminder}".`,
    PhoneNumber: phoneNumber
  };
  const sns = new AWS.SNS();
  console.log('sending message', params);
  return new Promise((resolve, reject) => {
    sns.publish(params, (err) => {
      if (err) {
        console.log('Failed to send message', err);
        return reject(err);
      }
      console.log('Message send successfully');
      resolve();
    });
  });
}

function lookupPhoneNumber (userId) {
  const params = {
    Key: {
      'userId': {
        S: userId
      }
    },
    TableName: 'RemindMeNumbers'
  };

  return new Promise((resolve, reject) => {
    dynamodb.getItem(params, (err, data) => {
      if (err) {
        return reject(err);
      }
      console.log('Pulled user from dynamo', data);
      if (!data.Item || !data.Item.phoneNumber || !data.Item.phoneNumber.S) {
        return reject(new Error('Cannot send reminder. User has no phone number stored'));
      }
      return resolve(data.Item && data.Item.phoneNumber && data.Item.phoneNumber.S);
    });
  });
}
function processReminder (reminder) {
  console.log('processing reminder', reminder);
  lookupPhoneNumber(reminder.userId.S)
    .then((phoneNumber) => {
      return sendMessage({ phoneNumber, reminder: reminder.reminder.S });
    })
    .then(() => {
      return deleteReminder(reminder);
    });
}

function processReminders (reminders) {
  return reminders.map((reminder) => {
    return processReminder(reminder);
  });
}

function deleteReminder (reminder) {
  const params = {
    TableName: 'RemindMeReminders',
    Key: {
      reminderId: {
        S: reminder.reminderId.S
      },
      ttl: {
        S: reminder.ttl.S
      }
    }
  };

  console.log('attempting to delete item', params);
  return new Promise((resolve, reject) => {
    dynamodb.deleteItem(params, (err) => {
      if (err) {
        console.log('Failed to delete item', err);
        return reject(err);
      }
      return resolve();
    });
  });
}

function getPendingReminders () {
  const now = moment();
  const end = now.toISOString();
  const params = {
    TableName: 'RemindMeReminders',
    FilterExpression: '#ttl < :end',
    ExpressionAttributeNames: {
      '#ttl': 'ttl'
    },
    ExpressionAttributeValues: {
      ':end': { S: end }
    }
  };
  console.log('Scanning for reminders', params);
  return new Promise((resolve, reject) => {
    dynamodb.scan(params, (err, results) => {
      if (err) {
        return reject(err);
      }
      return resolve(results);
    });
  });
}

function processQueue () {
  return getPendingReminders()
    .then((reminders) => {
      console.log('Fetched queued reminders', reminders);
      processReminders(reminders.Items);
    })
    .catch((err) => {
      console.log('failed to process queue', err);
    });
}

exports.handler = function (event, context) {
  processQueue();
};

exports.processQueue = processQueue;
