/* Utilty Functions */
exports._isJson = function(str){
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

exports._isObject = function(a){
    return (!!a) && (a.constructor === Object);
};

exports._isArray = function(a){
    return (!!a) && (a.constructor === Array);
};

exports._startsWith = function(str, word){
    return str.indexOf(word) === 0;
};
exports._endsWith = function(str, suffix){
    return str.match(suffix+"$")==suffix
};

exports._clone = function(o) {
    var ret = {};
    Object.keys(o).forEach(function (val) {
        ret[val] = o[val];
    });
    return ret;
};

exports._isNodeConnectionAlive = function(socket) {

    //Check if socket is okay
    return !(!socket || !socket.isConnected ||socket.destroyed || !socket.writable || !socket.buffer || !socket.buffer.write);
};

// Object to capture process exits and call app specific cleanup function

function noOp() {};

exports.Cleanup = function Cleanup(callback) {

    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || noOp;
    process.on('cleanup',callback);

    // do app specific cleaning before exiting
    process.on('exit', function () {
        process.emit('cleanup');
    });

    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
        console.log('Ctrl-C...');
        process.exit(2);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
        console.log('Uncaught Exception...');
        console.log(e);
        console.log(e.stack);
        process.exit(99);
    });
};