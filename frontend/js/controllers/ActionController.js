IoT.controller('IoTActionCtrl', function ($scope, $rootScope, $timeout, $compile, $routeParams, $location, constant, SocketFactory)
{
    //-----------------------------------------------------

    $rootScope.showLogout = true;

    $rootScope.sidebar =
    {
        "Sensor Data":
        [{
            title: "Dashboard",
            href: "#dashboard/" + $routeParams.client_id
        },
        {
            title: "History",
            href: "#history/" + $routeParams.client_id
        }],
        "Actions":
        [{
            title: "Action",
            href: "#action/" + $routeParams.client_id,
            active: true
        },
        {
            title: "If This, Then That",
            href: "#ifttt/" + $routeParams.client_id
        },
        {
            title: "Maintenance",
            href: "#maintenance/" + $routeParams.client_id
        },
        {
            title: "Video",
            href: "#video/" + $routeParams.client_id
        },
        {
            title: "Audio",
            href: "#audio/" + $routeParams.client_id
        }],
        "Device Overview":
        [{
            title: "Connected Devices",
            href: "#index"
        }]
    };

    //-----------------------------------------------------
    // tile colors

    $scope.buildColors = function()
    {
        $scope.colors = {};

        var baseStyles = ["primary", "gray", "amethyst", "city", "flat", "modern", "smooth"];
        var suffixes = ["", "light", "dark", "darker"];

        baseStyles.forEach(function(b, idx)
        {
            $scope.colors[idx] = [];

            suffixes.forEach(function(s)
            {
                var color = b;
                if (s) color += "-" + s;

                $scope.colors[idx].push("bg-" + color)
            });
        });
    };

    $scope.pickColor = function(actorname, idx)
    {
        var firstLetter = actorname[0].toLowerCase();
        //see http://stackoverflow.com/questions/22624379/how-to-convert-letters-to-numbers-with-javascript
        var alphabetPosition = firstLetter.charCodeAt(0) - 97;
        var colorgroup = alphabetPosition % Object.keys($scope.colors).length;

        if ($scope.colors[colorgroup].length <= idx)
        {
            idx -= ($scope.colors[colorgroup].length);
        }

        var color = $scope.colors[colorgroup][idx];

        return color;
    };

    //-----------------------------------------------------
    // color picker

    $scope.setColorPickerColor = function()
    {
        if (!("ledstrip" in $scope.actors)) return;

        var red = $scope.actors["ledstrip"]["singleColor"].params["red"].value;
        var green = $scope.actors["ledstrip"]["singleColor"].params["green"].value;
        var blue = $scope.actors["ledstrip"]["singleColor"].params["blue"].value;

        $scope.rgbPicker = "rgb(" + [red, green, blue].join(",") + ")";
    };

    $scope.watchColorPicker = function()
    {
        if (!("ledstrip" in $scope.actors)) return;

        var colors = [
            'actors["ledstrip"]["singleColor"].params["red"].value',
            'actors["ledstrip"]["singleColor"].params["green"].value',
            'actors["ledstrip"]["singleColor"].params["blue"].value'
        ];

        colors.forEach(function(c)
        {
            $scope.$watch(c, function(value)
            {
                console.log("color changed!");
                $scope.setColorPickerColor();
            });
        });
    };

    //colorpicker changed color
    $scope.colorChanged = function()
    {
        var rgb = $("[data-actor='ledstrip'] [data-method='singleColor'] [data-color]").attr("data-color").match(/(\d+)/g);
        $scope.actors["ledstrip"]["singleColor"].params["red"].value = rgb[0];
        $scope.actors["ledstrip"]["singleColor"].params["green"].value = rgb[1];
        $scope.actors["ledstrip"]["singleColor"].params["blue"].value = rgb[2];
    };

    //-----------------------------------------------------
    // persistence in localStorage

    $scope.getParamValue = function(actor, method, name)
    {
        var params = $scope.getParamStorage();

        if (actor in params && method in params[actor] && name in params[actor][method])
        {
            return params[actor][method][name];
        }

        return "";
    };

    $scope.getParamStorage = function()
    {
        var paramStorage = {};

        try {
            paramStorage = JSON.parse(localStorage.getItem("paramStorage") || "{}");
        } catch (err) {
            paramStorage = {};
        }

        return paramStorage;
    };

    $scope.setParamStorage = function(paramStorage)
    {
        localStorage.setItem("paramStorage", JSON.stringify(paramStorage));
    };

    //-----------------------------------------------------
    // logic

    $scope.execute = function(actor, method)
    {
        var isValid = true;
        var paramStorage = $scope.getParamStorage();
        var availableParams = $scope.actors[actor][method].params;
        var params = [];

        Object.keys(availableParams).forEach(function(paramName)
        {
            var val = availableParams[paramName].value;
            var isRequired = !availableParams[paramName].options.isOptional;

            availableParams[paramName].hasError = false;

            if (val.length === 0 && isRequired)
            {
                isValid = false;
                availableParams[paramName].hasError = true;
            }

            if (!(actor in paramStorage))
            {
                paramStorage[actor] = {};
            }

            if (!(method in paramStorage[actor]))
            {
                paramStorage[actor][method] = {};
            }

            paramStorage[actor][method][paramName] = val;
            params.push(val);
        });

        $scope.setParamStorage(paramStorage);

        if (!isValid)
        {
            return;
        }

        var execute = {
            actor: actor,
            method: method,
            params: params
        };

        console.log("EXECUTING", execute);

        $scope.actors[actor][method].execution = {
            state: true,
            message: "executed"
        };

        SocketFactory.send("ui:execute-actor", execute, function(err, msg)
        {
            if (err)
            {
                $scope.actors[actor][method].execution = {
                    state: false,
                    message: err
                };
            }
            else
            {
                console.log("got message", msg);

                msg = msg || "no answer from server";

                //special treatment section -----------------------------------------
                if (actor === "recorder" && method === "record")
                {
                    var soundfile = msg.split("/").pop();
                    return $location.path('/audio/' + $routeParams.client_id + '/autoplay/' + soundfile);
                }

                if (actor === "youtubedl" && method === "download2mp3")
                {
                    return $location.path('/audio/' + $routeParams.client_id);
                }

                if (actor === "cam" && method === "record")
                {
                    var videoname = msg.split(".")[0];
                    return $location.path('/video/' + $routeParams.client_id + '/autoplay/' + videoname);
                }
                //--------------------------------------------------------------------

                $scope.actors[actor][method].execution = {
                    state: true,
                    message: msg
                };
            }
        });
    };

    $scope.loadActors = function(onloaded)
    {
        //console.log("available options!");

        var ifttt = {
            mode: "availableoptions"
        };

        SocketFactory.send("ui:ifttt", ifttt, function(err, opts)
        {
            //console.log("got available options response", err, opts);

            if (err)
            {
                SocketFactory.callLifecycleCallback("functional_error", "Could not load actors: " + err);
            }
            else
            {
                console.log("the options", opts);

                $scope.actors = {};

                opts.actors.forEach(function(actor)
                {
                    $scope.actors[actor.name] = {};

                    actor.methods.forEach(function(method)
                    {
                        $scope.actors[actor.name][method.name] = {
                            params: {},
                            execution: {}
                        };

                        method.params.forEach(function(param)
                        {
                            $scope.actors[actor.name][method.name].params[param.name] = {
                                options: param,
                                value: $scope.getParamValue(actor.name, method.name, param.name)
                            }
                        });
                    });
                });

                $scope.setColorPickerColor();
                $scope.watchColorPicker();
                console.log("ACTORS", $scope.actors);
            }

            onloaded();
        });
    };

    //-----------------------------------------------------
    // init code

    $scope.checkAutoPlay = function()
    {
        var audio = $routeParams.audio;
        var lightshow = $routeParams.lightshow;

        if (audio || lightshow)
        {
            if (audio)
            {
                setTimeout(function()
                {
                    var element = $("[data-actor='music'] [data-method='play']");
                    Styles.hightlightScroll(element);
                    $scope.actors["music"]["play"].params["title"].value = audio;
                    $scope.execute("music", "play");
                }, 500);

            } else {
                setTimeout(function()
                {
                    var element = $("[data-actor='ledstrip'] [data-method='lightshow']");
                    Styles.hightlightScroll(element);
                    $scope.actors["ledstrip"]["lightshow"].params["title"].value = lightshow;
                    $scope.execute("ledstrip", "lightshow");
                }, 500);
            }
        }
    };

    $scope.musicSelection = function()
    {
        $location.path('/audio/' + $routeParams.client_id);
    };

    $scope.init = function()
    {
        $rootScope.mainHeadline = "IoT Portal: Actions";
        $rootScope.subHeadline = "Trigger Actions On Your IoT device";

        $scope.connect(false, function()
        {
            $scope.buildColors();
            $scope.loadActors(function()
            {
                $scope.loaded = true;
                $scope.$apply();
                $scope.checkAutoPlay();
            });
        });
    };

    //-----------------------------------------------------

    $scope.init();
});