require('dotenv').config()
const debug = require('debug')('app')
const express = require('express')
const bodyParser = require('body-parser')
const RateLimit = require('express-rate-limit');

const app = express()
const morgan = require('morgan')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const config = require('./config')
const store = require('./store')

require('./middlewares/passport')
//const SocketIoClient = require('./services/socketio/client')

//const socket = SocketIoClient()
const StatusEmitter = require('./services/StatusEmitter')

// Setting up basic middleware for all Express requests
const logger = morgan(function (tokens, req, res) {
  const output = [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ')
  StatusEmitter.sendLog('_server:log:api', output)
  return output
})
app.use(logger) // Log requests to API using morgan

// Enable CORS from client-side
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'content-disposition, Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Credentials')
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})

app.use(bodyParser.json())
// app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize())

const routes = require('./routes/routes');
const secureRoute = require('./routes/secure-route');

// app.enable('trust proxy'); // once this launches to nginx
const authLimiter = new RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  delayMs: 5, // disable delaying - full speed until the max limit is reached
  message: 'Too Many Requests. Please try again later..',
  handler(req, res /* next */) {
    debug('parent', this)
    if (this.headers) {
      res.setHeader('Retry-After', Math.ceil(this.windowMs / 1000));
    }
    res.status(this.statusCode).json({ error: this.message });
  }
});
app.use('/api/v2/auth', [authLimiter, routes])
app.use('/api/v2/', [authLimiter, passport.authenticate('jwt', { session: false }), secureRoute])

// Handle errors
app.use(function (err, req, res, next) {
  if (res.headersSent) return next(err)
  debug(err.stack)
  return res.status(err.status || 500).send({ error: err.toString() })
})


process.on('uncaughtException', function (err) {
  StatusEmitter.stop()
  debug(`Caught exception: ${err}`);
});

// start streaming logs towards dashboard server
module.exports = {
  listen(port, cb) {
    debug('start listen logic')
    //socket.register('_restApiServer', async (err) => {
      try {
        //await socket.join('_server:log:api')
       // debug(`Logs connected to room`)
        //await socket.join('_server:status')
       // debug(`Server Status connected to room`)

        app.listen(port, (listenErr) => {
          debug(`App listening on port: ${config.port}`)
          StatusEmitter.start()
          cb(listenErr)
        })
        return 'OK'
      } catch(err){
        debug(err)
        return cb(err)
      }
   // })
  }
}
