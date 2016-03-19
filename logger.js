var winston = require("winston");
var moment = require("moment");
var config = require("./config");

var logger = new (winston.Logger)
({
    level: 'verbose',
    transports: [
        new (winston.transports.Console)
        ({
            json: false,
            colorize: true,
            level: 'debug',
            prettyPrint: true,
            timestamp: function()
        {
            return moment().format("HH:mm:ss");
        }}),
        new (winston.transports.File)
        ({
            filename: config.logFile,
            maxFiles: 5,
            level: 'debug',
            maxsize: 1024 * 1024, //1mb
            timestamp: function()
            {
                return moment().format("DD.MM.YYYY HH:mm:ss");
            }
        })
    ],
    exitOnError: true
});

module.exports = logger;