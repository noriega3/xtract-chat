const Broadcaster = require('./logRoom/Broadcaster')

//wraps the queue instance into the Chatroom template
module.exports = (c) => Broadcaster(c)