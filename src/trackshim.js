(function ($, mejs) {

    /**
        Text track shim

        http://html5index.org/Media%20-%20Overview.html

        @TODO .on[eventtype] properties can be implemented fairly easily
            (add one listener for each event type that calls the property if exists)

        @TODO track add and remove events can be handled very nicely with MutationObserver (which can also be shimmed)

        @TODO Safari uses integers (0,1,2) instead of strings (disabled,showing,hidden) for track modes.
        @TODO IE Server MIME type for text/vtt must be set.
    */

    function isFirefox (version) {
        return (new RegExp('Firefox/'+(version||'')).test(navigator.userAgent));
    }

    function setTrackNode (track) {
        $('track').each(function () {
            if (this.track && !this.track.node && (!track || this.track === track)) {
                this.track.node = this;
                if (track) track.node = this;
            }
        });
    }

    // do asap on tracks
    $(function () {setTrackNode();});

    /**
        MediaElementTrackTrait

        This is a trait of methods meant to be injected into MediaElement shim
        (since mediaelement.js does not shim textTrack-related stuff)
    */
    mejs.MediaElementTracksTrait = {
        /**
            addTextTrack
            Default mode of such a track is hidden

            how is it different then HTML5 API
            - it takes options parameter (@see mejs.TextTrack for all the options)
                This is not a problem in native, options argument will simply be ignored
                (and native TextTrack constructor is forbidden anyways - at least chrome - @TODO)
        */
        addTextTrack: function (kind, label, language, options) {
            options || (options = {});
            options.kind = kind; options.label = label; options.language = language;
            var textTrack = new mejs.TextTrack(options);
            this.textTracks.push(textTrack);
            return textTrack;
        },


        /**
            _initTextTracks

            This must be called on mediaElement (plugin OR standard with no texttrack api OR standard with texttrack api only polyfilled)
            ASAP (when dom in mediaElement is ready) in order for shimmed tracks to work correctly

            It will
            1. initialize textTracks property
            2. hook addtrack event to hook modechange event to activate/deactivate listening to timeupdate events on mediaElement
            3. call _parseTextTracks to find all track subelements to given elem and load them to .textTracks
        */
        _initTextTracks: function (elem, parseTracks) {
            var that = this
                shimmed = this.pluginType != 'native' || window.TextTrack.shim
                    || isFirefox();
            if (!this.textTracks) {
                this.textTracks = new mejs.TextTrackList();
            }
            this.textTracks.addEventListener('addtrack', function (e) {
                if (!e.track.node) setTrackNode(e.track);
                // if text tracks are shimmed, set up _activate and _deactivate (which take care of _update calls)
                if (shimmed) {
                    e.track._initTextTrack();
                    if (e.track.mode != 'disabled') {
                        e.track._activate(that);
                    }
                    e.track.addEventListener('modechange', function (e) {
                        if (e.track.mode == 'disabled') e.track._deactivate(that);
                        else e.track._activate(that);
                    });
                } else {
                    e.track._initTextTrack();
                }
            });
            $.each(this.textTracks, function (i, t) { t._initTextTrack(); });

            if (parseTracks) {
                this._parseTextTracks(elem);
            }
        },


        /**
            _parseTextTracks

            @TODO MutationObserver to enable (better) addtrack event and removetrack event at all
        */
        _parseTextTracks: function (elem) {
            var that = this, textTrack;
            $(elem).find('track').each(function () {
                var el = $(this)[0];
                textTrack = that.addTextTrack($(el).attr('kind'), $(el).attr('label'), $(el).attr('srclang'),
                    {id: $(el).attr('id'), node: el, src: $(el).attr('src')});
            });
        }

    };

    /**
        TextTrackList shim

        use addTextTrack on mediaelement to add new tracks!

        @TODO
        does not have addtrack, removetrack and change events

        Events
        addtrack        fired when addTextTrack on mediaelement is called @TODO mutationObserver
        removetrack     @TODO achieve this with MutationObserver
        change          @TODO
    */
    mejs.TextTrackList = function () {};
    mejs.TextTrackList.prototype = new Array;
    $.extend(mejs.TextTrackList.prototype, EventDispatcher.prototype, {
        push: function (track) {
            console.warn('Use addTextTrack on player instead of using textTracks as array');
            Array.prototype.push.apply(this, $.makeArray(arguments));
            this.dispatchEvent(new mejs.TrackEvent('addtrack', {track: track}));
            if (track.node && $(track.node).attr('default')) track.setMode('showing');
        },
        getTrackById: function (id) {
            for (var i = 0; i < this.length; i += 1) {
                if (this[i].id == id) return this[i];
            }
        },
        item: function (i) {
            return this[i];
        }
    });

    /**
        TextTrack trait
    */
    mejs.TextTrackTrait = {
        _initTextTrack: function () {
            // fill missing cue ids
            var that = this,
                node = this.node;
            this.ready(function () {
                // since we are ready, request was successful
                if (that.mode == 'disabled') {
                    that.setMode('hidden');
                }
                var cue, id = 1;
                while(cue = that.cues.getCueById('')) {
                    while(that.cues.getCueById(id)) {
                        id += 1;
                    }
                    cue.id = id;
                }
            });

            // poll for readyState changes in FF 31/32
            if (isFirefox(31) || isFirefox(32)) {
                var interval = setInterval(function () {
                    var state = (that.node._readyState||that.node.readyState);
                    if (state > 1) {
                        if (state === 2) that.node.dispatchEvent(new mejs.TrackEvent('load', {track: that}));
                        clearInterval(interval);
                    }
                }, 1000);
            }

            this._bound_update = function (e) { that._update(e); };

            // metadata should be hidden by default (firefox is so smart that it will show "showing" metadata tracks as subtitles)
            if (this.kind == 'metadata' && this.getMode() == 'disabled') {
                this.setMode('hidden');
            }
        },
        setMode: function (mode) {
            if (this instanceof mejs.TextTrack && this.mode != mode) {
                this._mode = mode;
                this.dispatchEvent(new mejs.TrackEvent('modechange', {track: this}));
            } else if (!(this instanceof mejs.TextTrack) && this._mode != mode) {
                this.mode = mode;
                this.dispatchEvent(new mejs.TrackEvent('modechange', {track: this}));
            }
        },
        getMode: function () {
            if (this instanceof mejs.TextTrack) return this._mode;
            return this.mode;
        },
        ready: function (f) {
            var node = this.node || (this.id && $('#'+this.id)[0]);  // @TODO
            if (node) {
                if ((node._readyState||node.readyState) === 2 || (node._readyState||node.readyState) === 3) {
                    setTimeout(f, 0);
                } else {
                    var cb = function () {
                        if ((node._readyState||node.readyState) > 1) {
                            node.removeEventListener('load', cb);
                            node.removeEventListener('readystatechange', cb);
                            setTimeout(f, 0);
                        }
                    };
                    node.addEventListener('load', cb);
                    node.addEventListener('readystatechange', cb);
                }
            } else {
                console.warn('TextTrack id missing! .ready only works with native TextTrack support if <track> node has id attribute set!');
            }
            return this;
        },
        _activate: function (mediaElement) {
            mediaElement.addEventListener('timeupdate', this._bound_update);
        },
        _deactivate: function (mediaElement) {
            mediaElement.removeEventListener('timeupdate', this._bound_update);
        },
        _update: function (event) {
            // based on video.js
            // if target missing we take it from event.mediaElement (for test purposes?)
            var mediaElement = event.target || event.mediaElement,
                updateData = this._updateData || {},
                cues = this.cues,
                time = mediaElement.currentTime;
            if (this.cues.length) {

                if (updateData.prevChange === undefined
                    || time < updateData.prevChange
                    || updateData.nextChange <= time) {
                    var newNextChange = mediaElement.duration,
                        newPrevChange = 0,
                        newCues = new mejs.TextTrackCueList,
                        reverse = false,
                        entered = [],
                        exited = [],
                        firstActiveIndex,
                        lastActiveIndex,
                        cue, i;

                    // check if forward/rewinding
                    if (time >= updateData.nextChange || updateData.nextChange === undefined) {
                        i = (updateData.firstActiveIndex !== undefined) ? updateData.firstActiveIndex : 0;
                    } else {
                        reverse = true;
                        i = (updateData.lastActiveIndex !== undefined) ? updateData.lastActiveIndex : cues.length - 1;
                    }

                    while(true) {
                        cue = cues[i];

                        // cue ended
                        if (cue.endTime <= time) {
                            newPrevChange = max(newPrevChange, cue.endTime);

                            if (cue.active) {
                                cue.active = false;
                                exited.push(cue);
                            }

                        // cue hasnt started
                        } else if (time < cue.startTime) {
                            newNextChange = min(newNextChange, cue.startTime)

                            if (cue.active) {
                                cue.active = false;
                                exited.push(cue);
                            }

                            // No later cues should have an active start time.
                            if (!reverse) { break; }

                        // cue is current
                        } else {

                            if (reverse) {
                                // Add cue to front of array to keep in time order
                                newCues.splice(0,0,cue);
                                // @TODO call addCue on activeCues (which should take care of proper order?!)

                                // If in reverse, the first current cue is our lastActiveCue
                                if (lastActiveIndex === undefined) {
                                    lastActiveIndex = i;
                                }
                                firstActiveIndex = i;
                            } else {
                                // Add cue to end of array
                                newCues.push(cue);

                                // If forward, the first current cue is our firstActiveIndex
                                if (firstActiveIndex === undefined) { firstActiveIndex = i; }
                                lastActiveIndex = i;
                            }

                            newNextChange = min(newNextChange, cue.endTime);
                            newPrevChange = max(newPrevChange, cue.startTime);

                            cue.active = true;
                            entered.push(cue);
                        }

                        if (reverse) {
                            // Reverse down the array of cues, break if at first
                            if (i === 0) { break; } else { i--; }
                        } else {
                            // Walk up the array fo cues, break if at last
                            if (i === cues.length - 1) { break; } else { i++; }
                        }
                    }

                    this.activeCues = newCues;  // @TODO fill them (call addcue?)
                    updateData.nextChange = newNextChange;
                    updateData.prevChange = newPrevChange;
                    updateData.firstActiveIndex = firstActiveIndex;
                    updateData.lastActiveIndex = lastActiveIndex;
                    this._updateData = updateData;

                    // fire events
                    /*for(i = 0; i < entered.length; i+=1) {
                        entered[i].dispatchEvent(new mejs.TrackEvent('enter', {cue: entered[i]}));
                    }
                    for(i = 0; i < exited.length; i+=1) {
                        exited[i].dispatchEvent(new mejs.TrackEvent('exit', {cue: exited[i]}));
                    }*/
                    this.dispatchEvent(new mejs.TrackEvent('cuechange', {track: this}));
                }
            }
        }
    };

    mejs.TextTrackCueTrait = {
        isActive: function () {
            return Array.prototype.indexOf.apply(this.track.activeCues, [this]) > -1;
        }
    };

    // min and max that are undefined-safe (NaN-check)
    var min = function (a,b) { var m = Math.min(a,b); return (m != m) ? a||b : m;},
        max = function (a,b) { var m = Math.max(a,b); return (m != m) ? a||b : m;};

    /**
        TextTrack

        Should not be instantiated directly
        (e.g. Chrome throws 'Illegal constructor when doing this')
        Use addTextTrack on mediaelement

        How is it different than standard HTML5 API?
        - setting mode should be done through .setMode (instead of setting .mode property directly)
            (we define setter but in old browsers this will not work)
        - with native TextTrack support, constructing it will throw an error (these options below are arbitrary)

        @param      options         Object
        @param      options.kind
        @param      options.label
        @param      options.language
        @param      options.id
        @param      options.src
        @param      options.node
        @param      options.done    Function    done callback for loadCues ajax request
        @param      options.fail    Function    fail callback for loadCues ajax request

        Events:
        cuechange
        modechange  @NONSTANDARD when using setMode() this event will fire
        load        track loaded
    */
    mejs.TextTrack = function (options) {
        var that = this, promise;
        options || (options = {});
        this.kind = options.kind || 'subtitles';
        this.label = options.label||'';
        this.language = options.language||'';
        this.id = options.id;
        this.node = options.node;
        if (this.node) this.node.track = this;
        this.src = options.src;
        this.cues = new mejs.TextTrackCueList;
        this.activeCues = new mejs.TextTrackCueList;

        this._mode = options.mode || 'hidden';   // disabled, hidden, showing
        if (!this.node) console.warn('Use addTextTrack on player instead of instantiating TextTrack manually');

        // @TODO        if we have the node we can listen to it being removed and also remove track from the tracklist

        // we set up setters and getters here (also gets called when polyfilling texttracks)
        if (Object.defineProperty) Object.defineProperty(this, 'mode', {set: this.setMode, get: this.getMode});

        // load cues
        this._loadCues();
    };
    $.extend(mejs.TextTrack.prototype, EventDispatcher.prototype, mejs.TextTrackTrait, {
        addCue: function (cue) {
            // @TODO order
            //if (mejs.TextTrackCue.prototype.isPrototypeOf(cue)) {
                this.cues.push(cue);
            //}
        },
        removeCue: function (cue) {
            //if (mejs.TextTrackCue.prototype.isPrototypeOf(cue)) {
                var i = this.cues.indexOf(cue);
                if (i === -1) {
                    throw new Error("Failed to execute 'removeCue' on 'TextTrack': The specified cue is not listed in the TextTrack's list of cues.");
                }
                this.cues.splice(i, 1);
            //}
        },
        /**
            Load track src

            @type   jQuery.promise
        */
        _loadCues: function ()  {
            // only when shimmed, this.node will be present
            // TextTrack API specification does not have .node property
            if (this.node && !this.node._readyState) { // 0 - None, 1 - Loading, 2 - Loaded, 3 - Error
                var node = this.node,
                    track = this;
                node._readyState = 1;   // @TODO ready state change
                return $.ajax({
                    url: this.src,
                    dataType: 'text',
                    success: function (d) {
                        // parse the loaded file
                        var entries;
                        if (typeof d == "string" && (/<tt\s+xml/ig).exec(d)) {
                            // @TODO this is not tested
                            entries = mejs.TrackFormatParser.dfxp.parse(d);
                        } else {
                            entries = mejs.TrackFormatParser.webvvt.parse(d);
                        }
                        var cue;
                        for (var i = 0; i < entries.text.length; i += 1) {
                            // Chrome deprecated the TextTrackCue constructor
                            // @TODO this needs more testing
                            cue = new (window.VTTCue||window.TextTrackCue)(
                                entries.times[i].start,
                                entries.times[i].stop,
                                entries.text[i]
                            , {
                                track: track,
                                id: entries.ids[i]
                            });
                            track.addCue(cue);
                        }
                        node._readyState = 2;
                        track.node.dispatchEvent(new mejs.TrackEvent('load', {track: track}));
                    },
                    error: function () {
                        node._readyState = 3;
                        track.node.dispatchEvent(new mejs.TrackEvent('error', {track: track}));
                    }
                });
            }
        }
    });
    mejs.TextTrack.shim = true;


    /**
        Text track cue list

        This is really minimal, no events
    */
    mejs.TextTrackCueList = function () {

    };
    mejs.TextTrackCueList.prototype = new Array;
    $.extend(mejs.TextTrackCueList.prototype, EventDispatcher.prototype, {
        getCueById: function (id) {
            for (var i = 0; i < this.length; i += 1) {
                if (this[i].id == id) return this[i];
            }
        }
    });


    /**
        TextTrackCue

        Can be instantiated directly (existing HTML5 implementation support this)

        @param  startTime           Float           start time in seconds
        @param  endTime             Float           end time in seconds
        @param  text                String          text
        @param  options             Object          options
        @param  options.id          String          string id (line above the time in .vtt format)
        @param  options.pauseOnExit Boolean         whether to pause the video when this cue is ended
        @param  options.track       mejs.TextTrack  parent TextTrack

        Events:
        enter
        exit
    */
    mejs.TextTrackCue = function (startTime, endTime, text, options) {
        if (typeof startTime == 'undefined' || typeof endTime == 'undefined' || typeof text == 'undefined') {
            throw new Error("Failed to construct 'TextTrackCue': 3 arguments required.")
        }
        options || (options = {});
        this.startTime = parseFloat(startTime);
        this.endTime = parseFloat(endTime);
        this.text = ''+text;
        this.id = options.id;
        this.track = options.track;
    }
    $.extend(mejs.TextTrackCue.prototype, mejs.TextTrackCueTrait, EventDispatcher.prototype, {
    });


    /**
        TrackEvent
        In addition to standard window.Event, it has a track (and cue) parameters

        @param      Object          params
        @param      Boolean         params.bubbles
        @param      Boolean         params.cancelable
        @param      mejs.TextTrack  params.track
    */
    mejs.TrackEvent = function (type, params) {
        params = params || { bubbles: false, cancelable: false, track: undefined };
        var evt = document.createEvent('CustomEvent');
        evt.initEvent(type, params.bubbles, params.cancelable);
        if (params.track && !(mejs.TextTrack.prototype.isPrototypeOf(params.track) || window.TextTrack.prototype.isPrototypeOf(params.track))) {
            throw new Error("Failed to construct 'TrackEvent': 'track' property does not look like a TextTrack");
        }
        evt.track = params.track;
        evt.cue = params.cue;
        evt.target = evt.cue || evt.track;
        evt.currentTarget = evt.target; evt.srcElement = evt.target;
        return evt;
    }
    mejs.TrackEvent.prototype = window.Event;




    // ========================================================================
    // May the polyfill begin!
    // Unicorns breed here NSFW
    // @TODO needs testing in old browsers (and Firefox lolkillmenao)
    // ========================================================================

    // ====== MediaElement shims

    // extend mediaelement.js plugin prototype
    $.extend(mejs.PluginMediaElement.prototype, mejs.MediaElementTracksTrait);

    // make sure when plugin is initialized, _initTextTracks is called
    var oldCreate = mejs.HtmlMediaElementShim.create,
        oldCreatePlugin = mejs.HtmlMediaElementShim.createPlugin;
    mejs.HtmlMediaElementShim.createPlugin = function (playback, options, poster, autoplay, preload, controls) {
        var plugin = oldCreatePlugin.call(this, playback, options, poster, autoplay, preload, controls);
        plugin._initTextTracks(playback.htmlMediaElement, true);  // actual video element, not object/embed if plugin..
        console.info("Initializing mediaelement shim");
        return plugin;
    };
    mejs.HtmlMediaElementShim.create = function (el, o) {
        var api = oldCreate.call(this, el, o);
        // flash/silverlight
        if (api.pluginType != 'native') {
            // already inited text tracks at .createPlugin (see above)

        // html5 but shimmed track api
        } else if (window.TextTrack.shim) {
            console.info("Initializing textrack shim");
            $.extend(api, mejs.MediaElementTracksTrait);
            api._initTextTracks(api, true);

        } else {
            api._initTextTracks = mejs.MediaElementTracksTrait._initTextTracks;
            api._initTextTracks(api);
        }
        return api;
    }


    // shim HTMLVideoElement if no support for textTrack (@TODO test on old firefoxes - or current? :D)
    if (window.HTMLVideoElement && !window.HTMLVideoElement.prototype.addTextTrack) {
        // @TODO call _initTextTracks on initialize (just like with PluginMediaElement)
        $.extend(window.HTMLVideoElement.prototype, mejs.MediaElementTracksTrait);
    }

    // ====== TextTrack shims
    if (!window.TextTrack) {
        window.TextTrack = mejs.TextTrack;
        //window.TextTrack.shim = true;
    } else {
        // this will add .setMode(), .getMode() and .ready() to TextTrack
        console.info("Polyfilling TextTrack.setMode, .getMode and .ready");
        $.extend(window.TextTrack.prototype, mejs.TextTrackTrait);
    }

    // ====== TextTrackList shims
    if (!window.TextTrackList) {
        window.TextTrackList = mejs.TextTrackList;
        window.TextTrackList.shim = true;
    }

    // ====== TextTrackCueList shims
    if (!window.TextTrackCueList) {
        window.TextTrackCueList = mejs.TextTrackCueList;
        window.TextTrackCueList.shim = true;
    }

    // ====== TextTrackCue shims
    if (!window.TextTrackCue) {
        window.TextTrackCue = mejs.TextTrackCue;
        window.TextTrackCue.shim = true;
    } else {
        console.info("Polyfilling TextTrackCue.isActive");
        $.extend(window.TextTrackCue.prototype, mejs.TextTrackCueTrait);
    }

    // ====== TrackEvent shims
    if (!window.TrackEvent) {
        window.TrackEvent = mejs.TrackEvent;
        window.TrackEvent.shim = true;
    }

}(jQuery, mejs));
