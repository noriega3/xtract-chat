/*
 Access token:
 It contains all the information the server needs to know if the user / device can access the resource you are requesting or not.
 They are usually expired tokens with a short validity period.

 Refresh token:
 https://security.stackexchange.com/questions/133388/does-expiring-the-oauth-refresh-token-at-the-same-time-as-the-access-token-have
 do not use refresh tokens to retrieve or set data, only to validate user and set a new refresh token.
 The refresh token is used to generate a new access token.
 Typically, if the access token has an expiration date, once it expires, the user would have to authenticate again to obtain an access token.
 With refresh token, this step can be skipped and with a request to the API get a new access token that allows the user to continue accessing the application resources.
 */

const debug = require('debug')('app:queue')
const Queue = require('bull')
const uuidv4 = require('uuid/v4')

const _get = require('lodash/get')
const _map = require('lodash/map')

const DataRequest = require('./')

const database = require('../../store').db

const requestQueue = new Queue('UserDataQueue', {
  redis: {
    host: process.env.REQDB_HOST || '127.0.0.1',
    port: process.env.REQDB_PORT || 6379
  }
}) // we'll use pubsub redis server for this queue

// TODO: this needs to go into a queue system

requestQueue.process('req', async (job, done) => {
  const userId = _get(job, 'data.userId')
  const fileName = _get(job, 'data.fileName')
  if (!userId || !fileName) throw new Error('invalid data received')
  job.progress(25)
  const zipArrData = await DataRequest.getUserDataArr(job.data)
  job.progress(50)
  await DataRequest.zipUserData(fileName, zipArrData)
  job.progress(75)
  await DataRequest.removeStoredUserDataFile(userId)
  job.progress(90)
  // store new file name (confirmation id) to _lastDataRequestId
  await database.hset(`users:${userId}`, '_lastDataRequestId', fileName)

  job.progress(100)

  done(null, { confirmationId: fileName })
})

requestQueue.on('error', (error) => {
  // An error occured.
  debug('[REQUEST Q]: ', error.toString())
})

requestQueue.on('cleaned', (jobs, type) => {
  debug('Cleaned %s %s jobs', jobs.length, type)
  _map(jobs, (job) => {
    DataRequest.removeUserDataFile(job.data.fileName)
  })
})

function addToQueue(userId) {
  const fileName = uuidv4()
  // note: jobId = userId
  return requestQueue.add('req', { userId, fileName }, { jobId: userId, removeOnFail: true })
}

function cleanExpiredRequests() {
  requestQueue.clean(2592000000)
}

function cleanFailedRequests() {
  requestQueue.clean(10000, 'failed')
}

function autoClean() {
  cleanFailedRequests()
  cleanExpiredRequests()
}

async function getStatus(jobId) {
  // we'll auto clean when state is called every time
  autoClean()
  const job = await requestQueue.getJob(jobId)
  const lastRequestTime = job ? job.finishedOn : -1
  const progress = job ? job._progress : -1

  return { progress, lastRequestTime }
}

async function getFinished(jobId) {
  return requestQueue.getJob(jobId).call('finished').catchReturn(false)
}

async function remove(jobId) {
  await DataRequest.removeStoredUserDataFile(jobId) // jobId === userId
  return requestQueue.getJob(jobId).call('remove').catchReturn(false)
}

module.exports = {
  addToQueue,
  getStatus,
  getFinished,
  remove
}
