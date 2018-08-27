/* global describe it */
const chai = require('chai')
chai.config.includeStack = true; // turn on stack trace
chai.config.showDiff = true; // turn off reporter diff display
let should = chai.should()
let expect = chai.expect

const uuidv4 		= require('uuid/v4')
const request 		= require('request')

//simulated client (taken functions from dashboard)
process.env.NODE_PATH = '.'
process.env.DEBUG_COLORS = true
process.env.DEBUG_HIDE_DATE = true
process.env.NODE_ENV = "development"
process.env.DEBUG = "*,-not_this,-ioredis:*,-bull"

const HTTP_SERVER_PORT = process.env.HTTP_SERVER_PORT

describe('HTTP Server',function(){
    this.timeout(10000)
    let args = {
        "sessionId": uuidv4(),
        "appName": "source",
        "userId": 50001,
        "roomName": "source:slots:enchantedForest",
        "params": {
            "isGameRoom": true
        }
    }

    //test against dummy data
    it('reserve room with path and game room', function(done){
        args.params = {
            "isGameRoom": true
        }

        new request({
            method: 'POST',
            url: `http://0.0.0.0:${HTTP_SERVER_PORT}/api/v1/room/reserve`,
            json:true,
            body: args,
        }, (err, response, resBody) => {
            resBody.should.be.an('object')
            resBody.should.to.have.nested.property('response.roomName')
            resBody.response.roomName.should.to.have.string(args.roomName)
            resBody.should.to.have.nested.property('response.message')
            resBody.response.message.should.to.have.string('Reserved the seat for game room: '+args.roomName)
            resBody.should.to.have.nested.property('response.params')
            resBody.response.params.should.to.have.nested.property('isGameRoom')

            done(err)
        })
    })

})
