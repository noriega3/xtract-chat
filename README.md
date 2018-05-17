# xtract.chat


## General Information
A pubsub built with scaling in mind. Simply: Node.js tcp server with a redis caching backend.

Started with Noobhub, but with lots of research, decided to build something a more robust.
This is the open source variation that is used on xtractstudios/codes games.

**WARNING:** this is very 'alpha' and probably will not work locally until a release is finished.  

## How To Install

- [Install]()
  - [Node.js]()
  - [Corona SDK (Lua)]()
  - [Web Browsers]()

## How To Use

## Troubleshooting

## Examples

## API Reference
  - [Request Layouts](./wiki/RequestLayouts.md)
  - [Response Layouts](./wiki/ResponseLayouts.md)
  
## Changelog   
### 2.0.5a - May 2nd-17th 2018 
- setup room ticks to get room updates every x seconds
- fix up bots logic
- add publish to room updates on subscribe and unsubscribe
- fixing api http server to use withDatabase
- update structures
- update express validator 
- add elastic-apm-node
- monitor redis and node functions
- fix process titles not changing
- progress re-fixing non exiting child processes
- undo es6 functions where needed
- add process title to jobs when title is equal to node
- add server monitoring using apm
- code uniform on job files
- fixed child processes not closing on completion
- rename intent to pending game room
- don’t promise method automatically, only on declaration 
- add more of the shared.js functions to own file to save memory
- clean up the init job,
- remove the promise.method to jobs (already being done with bull)
- use clone to have the gc clean up better to unreferenced objects
- add the server error message to the unsub message on client
- add promise method on direct calls to jobs when not using bull queue
- rename client to db when calling redis
- continue fixing subscribe/unsub logic with one redis instance shared between worker
- conversion to use promise.methods to always have a promise on function calls
- fix destroying of client
- add backoff to bull queue to fix redis saving too slow when calling a value just set
- add identifier to addQueue
- add auto clean to all queues when any job completes in the queue
- continue search for source of memory leak
- add a text file that writes when server is on/off
- add places for withDatabase replacing using 
- modularize sub logic
- standardize data coming into server to  session, params, room[optional]
- fixing memory leaks for queues
- reorganize queues to just use one function
- add queue for incoming socket data to rate limit
- removed unused code
- add syncing settings between redis and json config file
- auto generate config file from default when not present
- add error listener on bot
- fix initConfirm to use partials
- add custom commands to exactly before execution to save memory storage on redis
- add loading lua files via store file
- rename subscriber to main bot file
- add syncing settings between redis and json config file
- auto generate config file from default when not present
- add error listener on bot
- fix initConfirm to use partials
- add custom commands to exactly before execution to save memory storage on redis
- add loading lua files via store file
- rename subscriber to main bot file
- convert bots to use parallel processes
- fix memory leak on tick
- switch to withDatabase for bots
- move bot functions out of shared
- convert filter to es6 from lodash
- add params from roomtypeid
- all current valid tests
- fix unsubscribe logic

### 2.0.0-4a, Dec-May 1st (work in progress)
  - Sync private project with public (4 months of changes)
  - Closer to being 100%, converting to better practices of node and using a redux-like logic.
  - bull-queue with parallel processes
  - opting for a more modular approach to simple functions so GC can work a bit cleaner
  - lots more to come.. (will add more changelog that's happened in the 4+ months as it finishes up)
