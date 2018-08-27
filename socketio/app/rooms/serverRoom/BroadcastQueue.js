const Promise = require('bluebird')
const Queue = require('bull')
const os = require('os')
const _ = require('lodash')

const jobOptions = {
    delay: 5000,
    removeOnFail: true,
    removeOnComplete: true
}

const repeat = {cron: '*/2 * * * * *' }

module.exports = function (chatroom){

	console.log(process.env)

    const queue = new Queue('BroadcastQueue', {redis: `redis://${process.env.QUEUE_HOST || 'localhost' }:${process.env.QUEUE_PORT || 6379}`}) //we'll use pubsub redis server for this queue

    function test(){
		return Promise.all([
            queue.getRepeatableJobs().map((job) => {
                    console.log('removing job', job)
                    return queue.removeRepeatable(job)
                }),
            queue.clean(0, 'delayed'),
            queue.clean(0, 'wait'),
            queue.clean(0, 'active'),
            queue.clean(0, 'completed'),
            queue.clean(0, 'failed'),
            Promise.resolve(() => {
                let multi = queue.multi()
                multi.del(queue.toKey('repeat'))
                return multi.exec()
            })
        ]).then((res) => {
            console.log('results', res)
            return 'ok'
        })
    }
    //test()

    queue.process(() => {
        const roomProps = chatroom.serialize()

        if(roomProps.numMembers <= 0) {

            //TODO: stopped here, trying to remove repeatables
            queue.getRepeatableJobs().each((job) => {
                queue.removeRepeatable(job)
            }).then(() => {
                queue.clean(0)
            })
            return Promise.resolve('EMPTY')
        }

        chatroom.broadcastMessage({
			name: 'Dashboard Socket Server',
            uptime: os.uptime(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            loadavg: os.loadavg(),
			processmem: process.memoryUsage()
        })
        return Promise.resolve(`OK - ${Date.now()}`)
    })

    queue.on('error', (error) => {
        // An error occured.
        console.error('[Queue]: ', error)
    })


    //hook into add
    function addUser(props){ //if more than one parameter, switch to ...
        chatroom.addUser(props)
        queue.getRepeatableJobs().then((jobs) => {
            if(_.isEmpty(jobs)) {
                queue.add({}, {...jobOptions, repeat})
            }
        })
    }

    //hook into remove
    function removeUser(props){ //if more than one parameter, switch to ...
        chatroom.removeUser(props)
    }



    return {
        ...chatroom,
        addUser,
        removeUser
    }
}
