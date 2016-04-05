IoT.factory('SocketFactory', function(constant)
{
    var SocketFactory = {};

    SocketFactory.socket = null;
    SocketFactory.clientMessages = 0;
    SocketFactory.stats = {};

    SocketFactory.send = function(event, payload, callback)
    {
        payload = payload || {};
        callback = callback || null;
        payload.password = constant.get("password");
        SocketFactory.socket.emit(event, payload, function()
        {
            var err = arguments[0];

            if (err && err === "wrongpassword")
            {
                SocketFactory.callLifecycleCallback("wrongpassword");
                return;
            }

            if (err && err === "disconnect")
            {
                SocketFactory.callLifecycleCallback("disconnect", true);
                return;
            }

            callback && callback.apply(this, arguments);
        });
    };

    SocketFactory.receive = function(event, cb)
    {
        SocketFactory.socket.on(event, function()
        {
            cb.apply(this, arguments);
        });
    };

    SocketFactory.lifecycleCallbacks = {};

    SocketFactory.registerLifecycleCallback = function(eventType, callback, registerKey)
    {
        if (!SocketFactory.lifecycleCallbacks[eventType])
        {
            SocketFactory.lifecycleCallbacks[eventType] = {};
        }

        //the registerKey is used to determined if this callback type has already been registered.
        //do not register twice
        if (!registerKey)
        {
            registerKey = "randkey-" + Math.random() + "-" + (new Date).getTime();
        }

        if (registerKey in SocketFactory.lifecycleCallbacks[eventType])
        {
            console.log("overwriting callback for " + eventType + " - only once is allowed");
        }

        SocketFactory.lifecycleCallbacks[eventType][registerKey] = callback;

        console.log("registered " + Object.keys(SocketFactory.lifecycleCallbacks[eventType]).length + " callbacks for " + eventType);
    };

    SocketFactory.callLifecycleCallback = function(eventType)
    {
        if (!SocketFactory.lifecycleCallbacks[eventType])
        {
            console.log("no handler for lifecycle " + eventType);
            return;
        }

        //remove first parameter from arguments list
        var parameters = [];

        for (var i = 1; i < arguments.length; i++)
        {
            parameters.push(arguments[i]);
        }

        if (eventType != "dataupdate" && eventType != "iftttupdate")
        {
            console.log("called lifecycle callback for " + eventType, parameters);
        }

        for (var registerKey in SocketFactory.lifecycleCallbacks[eventType])
        {
            SocketFactory.lifecycleCallbacks[eventType][registerKey].apply(this, parameters);
        }
    };

    SocketFactory.resetLifecycleCallbacks = function()
    {
        SocketFactory.lifecycleCallbacks = {};
    };

    //------------------------------------------------------------

    SocketFactory.getCount = function(cb)
    {
        console.log("requesting count!");

        SocketFactory.count = "Loading count";

        var hasTriggered = false;

        var getCount = function(err, resp)
        {
            console.log("got count!");
            hasTriggered = true;

            if (err)
            {
                return cb(err);
            }

            SocketFactory.count = resp.count;

            return cb(null, SocketFactory.count);
        };

        setTimeout(function()
        {
            if (!hasTriggered)
            {
                return cb("Connection timeout");
            }
        }, 4000);

        SocketFactory.send('ui:data-count', {}, getCount);
    };

    SocketFactory.isConnected = function()
    {
        var isConnected = SocketFactory.socket !== null && SocketFactory.socket.connected === true;
        return isConnected;
    };

    SocketFactory.connectToDevice = function(id, cb)
    {
        if (SocketFactory.isConnected())
        {
            //SocketFactory.socket.disconnect();
        }

        SocketFactory.socket = io.connect("/", {
            reconnect: true,
            query: "mode=ui&client=" + id,
            'connect timeout': 1000,
            'reconnection delay': 100,
            'sync disconnect on unload': false,
            'max reconnection attempts': Infinity
        });

        SocketFactory.receive("connect", function()
        {
            console.log("connected to socket");
        });

        var socketEvents = [ 'connect', 'disconnect', 'connecting', 'connect_failed', 'close', 'reconnect', 'reconnecting', 'reconnect_failed' ];

        socketEvents.forEach(function(s)
        {
            (function(eventName)
            {
                SocketFactory.receive(s, function(ev)
                {
                    console.log(new Date() + " ======================== SOCKET EVENT: " + eventName + " ========================", ev);
                });
            }(s));

        });

        SocketFactory.receive("client-disconnected", function()
        {
            console.log("DISCONNECT client disconnect event!");
            SocketFactory.callLifecycleCallback("disconnect", true);
        });

        SocketFactory.receive("disconnect", function()
        {
            console.log("DISCONNECT server event");
            SocketFactory.callLifecycleCallback("disconnect", false);
        });

        SocketFactory.receive("progress", function(data)
        {
            console.log("onprogress " + data.progress);
        });

        SocketFactory.receive("dataupdate", function(msg)
        {
            //console.log(new Date() + " ======================== SOCKET DATA RECEIVED ========================");
            SocketFactory.clientMessages++;

            SocketFactory.callLifecycleCallback("dataupdate", msg, SocketFactory.clientMessages);
        });

        SocketFactory.receive("iftttupdate", function(msg)
        {
            SocketFactory.callLifecycleCallback("iftttupdate", msg);
        });

        SocketFactory.receive("youtube-download", function(msg)
        {
            SocketFactory.callLifecycleCallback("youtube-download", msg);
        });

        SocketFactory.send('ui:get-socket-info', {}, function(err, resp)
        {
            if (err)
            {
                return SocketFactory.callLifecycleCallback("socketinfo", err);
            }
            else
            {
                SocketFactory.capabilities = resp.capabilities;
                SocketFactory.clientName = resp.client_name;
                SocketFactory.connectedAt = moment(new Date(resp.connected_at)).format("DD.MM. HH:mm:ss").toString();

                //connected callback, some requests might depend on the clientName which is being set here
                if (cb)
                    cb(null, true);
            }

            return SocketFactory.callLifecycleCallback("socketinfo", null, SocketFactory.clientName, SocketFactory.connectedAt, SocketFactory.capabilities);
        });
    };

    return SocketFactory;
});