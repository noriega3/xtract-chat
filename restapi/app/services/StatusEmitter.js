const io = require('socket.io-emitter')({ host: process.env.PSDB_HOST, port: process.env.PSDB_PORT });
const os = require('os')
let _timer

io.redis.on('error', (err) => {
  console.log(err);
});

module.exports = {
  start() {
    _timer = setInterval(() => {
      console.log('sending message to server status room')

      const message = {
        name: 'Rest API Server',
        uptime: os.uptime(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
        processmem: process.memoryUsage(),
      }
      io.emit('server:message',{room: '_server:status', event: 'message', message: message})
    }, 5000)
    return 'OK'
  },
  sendLog(room,output){
    io.to(room).emit('message', output)
  },
  stop() { return _timer ? clearInterval(_timer) : 'OK'}
}
