const BroadcastQueue = require('./serverRoom/BroadcastQueue')

//wraps the queue instance into the Chatroom template
module.exports = (c) => BroadcastQueue(c)