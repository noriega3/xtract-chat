const Promise       = require('bluebird') //https://github.com/visionmedia/debug
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('events_room')
const globals       = require('../../globals')
const redisManager  = require('../redis_manager')
const roomQueue     = redisManager.roomQueue

let prepareList = {}

/**
 * List of functions that prepare the event
 */

prepareList._groupWin = (sessionId, params) => {
    const config = globals.getVariable("SERVER_CONFIG").roomEvents
    const minPayout    = parseInt(config["groupWin:minPayout"])
    const maxPayout    = parseInt(config["groupWin:maxPayout"])

    let total = params.totalAmountWon * params.betAmount
    let totalAmountWon = Math.floor((total * .25) / 25) * 25
    totalAmountWon = totalAmountWon < minPayout ? minPayout : totalAmountWon
    totalAmountWon = totalAmountWon > maxPayout ? maxPayout : totalAmountWon

    return Promise.props({
        "totalAmountWon": totalAmountWon,
        "betAmount": params.betAmount,
        "minPayout": minPayout,
        "maxPayout": maxPayout
    })
}

/**
 * This is after the event has been verified, and messages have been sent out from the prepare list
 */

roomQueue.process('groupWin', (job, done) => {
    //verifies an eventId for room queue processing.
    _log('in _groupwin verified')
    done()
})



module.exports = prepareList
