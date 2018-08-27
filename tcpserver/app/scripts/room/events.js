"use strict"

const Promise       = require('bluebird') //https://github.com/visionmedia/debug
const store			= require('../../store')
let eventList = {}

/**
 * List of functions that prepare the event
 */

eventList._groupWin = (sessionId, params) => {
    const roomEvents	= store.getConfig('roomEvents')
    const minPayout    = parseInt(roomEvents["groupWin:minPayout"])
    const maxPayout    = parseInt(roomEvents["groupWin:maxPayout"])

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
const attach = (queue) => {
	queue.process('groupWin', (job, done) => {
		//verifies an eventId for room queue processing.
		done()
	})
}
module.exports = {
	attach,
	...eventList
}
