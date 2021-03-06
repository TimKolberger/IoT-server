'use strict';

var constants = angular.module('IoTConstants', []);

constants.provider('constant', function()
{
    var config =
    {
        camRecordingDuration: 4
    };

    this.$get = function()
    {
        return {
            set: function(name, value)
            {
                config[name] = value;
            },
            get: function(name)
            {
                return config[name];
            }
        }
    };
});