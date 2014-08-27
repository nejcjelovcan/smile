// EventTarget interface http://www.w3.org/TR/DOM-Level-3-Events/#interface-EventTarget
//(MIT)
/**
 * @author mrdoob / http://mrdoob.com/
 */
(function (window) {
var EventDispatcher = window.EventDispatcher = function () {};
EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.addEventListener = EventDispatcher.prototype.addEventListener;
		object.hasEventListener = EventDispatcher.prototype.hasEventListener;
		object.removeEventListener = EventDispatcher.prototype.removeEventListener;
		object.dispatchEvent = EventDispatcher.prototype.dispatchEvent;

	},

	addEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) this._listeners = {};
		var listeners = this._listeners;
		
		if ( listeners[ type ] === undefined ) {
			listeners[ type ] = [];
		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {
			listeners[ type ].push( listener );
		}
	},

	hasEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) return false;
		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {
			return true;
		}
		return false;
	},

	removeEventListener: function ( type, listener ) {
		if ( this._listeners === undefined ) return;
		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {
			var index = listenerArray.indexOf( listener );
			if ( index !== - 1 ) {
				listenerArray.splice( index, 1 );
			}
		}
	},

	dispatchEvent: function ( event ) {
		if ( this._listeners === undefined ) return;
		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {
			event.target = this;
			var array = [];
			var length = listenerArray.length;

			for ( var i = 0; i < length; i ++ ) {
				array[ i ] = listenerArray[ i ];
			}

			for ( var i = 0; i < length; i ++ ) {
				array[ i ].call( this, event );
			}
		}
	}

};
}(window));
/**
    This code is copied from mep-feature-track.js MIT
    bower mediaelement#2.14.2       cached git://github.com/johndyer/mediaelement.git#2.14.2
    used by trackshim.js
*/
(function ($, mejs) {
    /*
    Parses WebVVT format which should be formatted as
    ================================
    WEBVTT
    
    1
    00:00:01,1 --> 00:00:05,000
    A line of text

    2
    00:01:15,1 --> 00:02:05,000
    A second line of text
    
    ===============================

    Adapted from: http://www.delphiki.com/html5/playr
    */
    mejs.TrackFormatParser = {
        webvvt: {
            // match start "chapter-" (or anythingelse)
            pattern_identifier: /^([a-zA-Z]+)?[0-9]+$/,
            pattern_timecode: /^([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{1,3})?) --\> ([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{3})?)(.*)$/,

            parse: function(trackText) {
                var 
                    i = 0,
                    lines = mejs.TrackFormatParser.split2(trackText, /\r?\n/),
                    entries = {text:[], times:[], ids:[]},
                    idcode,
                    timecode,
                    text;
                for(; i<lines.length; i++) {
                    // check for the line number
                    idcode = this.pattern_identifier.exec(lines[i]);
                    timecode = this.pattern_timecode.exec(lines[i]);
                    if (idcode || timecode){
                        // skip to the next line where the start --> end time code should be
                        if (idcode) {
                            i++;
                            timecode = this.pattern_timecode.exec(lines[i]);
                        }

                        if (timecode && i<lines.length){
                            i++;
                            // grab all the (possibly multi-line) text that follows
                            text = lines[i];
                            i++;
                            while(lines[i] !== '' && i<lines.length){
                                text = text + '\n' + lines[i];
                                i++;
                            }
                            text = $.trim(text).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                            // Text is in a different array so I can use .join
                            entries.text.push(text);
                            entries.ids.push(idcode ? idcode[0] : '');
                            entries.times.push(
                            {
                                start: (mejs.Utility.convertSMPTEtoSeconds(timecode[1]) == 0) ? 0.200 : mejs.Utility.convertSMPTEtoSeconds(timecode[1]),
                                stop: mejs.Utility.convertSMPTEtoSeconds(timecode[3]),
                                settings: timecode[5]
                            });
                        }
                    }
                }
                return entries;
            }
        },
        // Thanks to Justin Capella: https://github.com/johndyer/mediaelement/pull/420
        dfxp: {
            parse: function(trackText) {
                trackText = $(trackText).filter("tt");
                var 
                    i = 0,
                    container = trackText.children("div").eq(0),
                    lines = container.find("p"),
                    styleNode = trackText.find("#" + container.attr("style")),
                    styles,
                    begin,
                    end,
                    text,
                    entries = {text:[], times:[]};


                if (styleNode.length) {
                    var attributes = styleNode.removeAttr("id").get(0).attributes;
                    if (attributes.length) {
                        styles = {};
                        for (i = 0; i < attributes.length; i++) {
                            styles[attributes[i].name.split(":")[1]] = attributes[i].value;
                        }
                    }
                }

                for(i = 0; i<lines.length; i++) {
                    var style;
                    var _temp_times = {
                        start: null,
                        stop: null,
                        style: null
                    };
                    if (lines.eq(i).attr("begin")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("begin"));
                    if (!_temp_times.start && lines.eq(i-1).attr("end")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i-1).attr("end"));
                    if (lines.eq(i).attr("end")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("end"));
                    if (!_temp_times.stop && lines.eq(i+1).attr("begin")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i+1).attr("begin"));
                    if (styles) {
                        style = "";
                        for (var _style in styles) {
                            style += _style + ":" + styles[_style] + ";";                   
                        }
                    }
                    if (style) _temp_times.style = style;
                    if (_temp_times.start == 0) _temp_times.start = 0.200;
                    entries.times.push(_temp_times);
                    text = $.trim(lines.eq(i).html()).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                    entries.text.push(text);
                    if (entries.times.start == 0) entries.times.start = 2;
                }
                return entries;
            }
        },
        split2: function (text, regex) {
            // normal version for compliant browsers
            // see below for IE fix
            return text.split(regex);
        }
    };
    
    // test for browsers with bad String.split method.
    if ('x\n\ny'.split(/\n/gi).length != 3) {
        // add super slow IE8 and below version
        mejs.TrackFormatParser.split2 = function(text, regex) {
            var 
                parts = [], 
                chunk = '',
                i;

            for (i=0; i<text.length; i++) {
                chunk += text.substring(i,i+1);
                if (regex.test(chunk)) {
                    parts.push(chunk.replace(regex, ''));
                    chunk = '';
                }
            }
            parts.push(chunk);
            return parts;
        }
    }
}(jQuery, mejs));
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
                    if (e.track.mode != 'disabled') {
                        e.track._activate(that);
                    }
                    e.track.addEventListener('modechange', function (e) {
                        if (e.track.mode == 'disabled') e.track._deactivate(that);
                        else e.track._activate(that);
                    });
                    e.track._initTextTrack();
                } else {
                    e.track._initTextTrack();
                }
            });

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
                    var state = (node.readyState||node._readyState);
                    window.thaaat = that;
                    if (state > 1) {
                        if (state === 2) node.dispatchEvent(new mejs.TrackEvent('load', {track: that}));
                        clearInterval(interval);
                    }
                }, 1000);
            }

            this._bound_update = function (e) { that._update(e); };
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
            var node = this.node;
            if (node) {
                if ((node.readyState||node._readyState) === 2 || (node.readyState||node._readyState) === 3) {
                    setTimeout(f, 0);
                } else {
                    var cb = function () {
                        if (node.readyState > 1) {
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
(function (window, $) {
    var smile = window.smile = {};

    // Object literal parsing (derived from knockout.js binding/expressionRewriting.js)
    var javaScriptReservedWords = ["true", "false", "null", "undefined"],
        javaScriptAssignmentTarget = /^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i,
        stringDouble = '"(?:[^"\\\\]|\\\\.)*"',
        stringSingle = "'(?:[^'\\\\]|\\\\.)*'",
        stringRegexp = '/(?:[^/\\\\]|\\\\.)*/\w*',
        specials = ',"\'{}()/:[\\]',
        everyThingElse = '[^\\s:,/][^' + specials + ']*[^\\s' + specials + ']',
        oneNotSpace = '[^\\s]',
        bindingToken = RegExp(stringDouble + '|' + stringSingle + '|' + stringRegexp + '|' + everyThingElse + '|' + oneNotSpace, 'g'),
        divisionLookBehind = /[\])"'A-Za-z0-9_$]+$/,
        keywordRegexLookBehind = {'in':1,'return':1,'typeof':1};

    // derived from knockout.js binding/expressionRewriting.js
    function parseObjectLiteral (objectLiteralString) {
        // Trim leading and trailing spaces from the string
        var str = smile.util.stringTrim(objectLiteralString);

        // Trim braces '{' surrounding the whole object literal
        if (str.charCodeAt(0) === 123) str = str.slice(1, -1);

        // Split into tokens
        var result = [], toks = str.match(bindingToken), key, values, depth = 0;

        if (toks) {
            // Append a comma so that we don't need a separate code block to deal with the last item
            toks.push(',');

            for (var i = 0, tok; tok = toks[i]; ++i) {
                var c = tok.charCodeAt(0);
                // A comma signals the end of a key/value pair if depth is zero
                if (c === 44) { // ","
                    if (depth <= 0) {
                        if (key)
                            result.push(values ? {key: key, value: values.join('')} : {'unknown': key});
                        key = values = depth = 0;
                        continue;
                    }
                // Simply skip the colon that separates the name and value
                } else if (c === 58) { // ":"
                    if (!values)
                        continue;
                // A set of slashes is initially matched as a regular expression, but could be division
                } else if (c === 47 && i && tok.length > 1) {  // "/"
                    // Look at the end of the previous token to determine if the slash is actually division
                    var match = toks[i-1].match(divisionLookBehind);
                    if (match && !keywordRegexLookBehind[match[0]]) {
                        // The slash is actually a division punctuator; re-parse the remainder of the string (not including the slash)
                        str = str.substr(str.indexOf(tok) + 1);
                        toks = str.match(bindingToken);
                        toks.push(',');
                        i = -1;
                        // Continue with just the slash
                        tok = '/';
                    }
                // Increment depth for parentheses, braces, and brackets so that interior commas are ignored
                } else if (c === 40 || c === 123 || c === 91) { // '(', '{', '['
                    ++depth;
                } else if (c === 41 || c === 125 || c === 93) { // ')', '}', ']'
                    --depth;
                // The key must be a single token; if it's a string, trim the quotes
                } else if (!key && !values) {
                    key = (c === 34 || c === 39) /* '"', "'" */ ? tok.slice(1, -1) : tok;
                    continue;
                }
                if (values)
                    values.push(tok);
                else
                    values = [tok];
            }
        }
        return result;
    }

    smile.util = {
        // derived from knockout.js utils.js
        stringTrim: function (string) {
            return string === null || string === undefined ? '' :
                string.trim ?
                    string.trim() :
                    string.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
        },

        parseObjectLiteral: function (str) {
            var obj = {};
            $.each(parseObjectLiteral(str), function (i, item) {
                if (item.unknown) obj[item.unknown] = true;
                else obj[item.key] = item.value;
            });
            return obj;
        },

        capitalize: function (str) {
            return str.substr(0,1).toUpperCase() + str.substr(1);
        },

        /**
            underscore-ish bindAll
            this helper saves livers!
        */
        bindAll: function (obj, methodList) {
            for (var i = 0; i < methodList.length; i += 1) {
                obj[methodList[i]] = $.proxy(obj[methodList[i]], obj);
            }
            return obj;
        },

        horizontalAreas: function (area1, area2) {
            area1.ratio = area1.width/area1.height;
            area2.ratio = area2.width/area2.height;
            var data = {
                ratio: area1.ratio+area2.ratio,
                area1: area1,
                area2: area2
            };
            area1.widthPercentage = area1.ratio/data.ratio;
            area2.widthPercentage = area2.ratio/data.ratio;
            return data;
        },

        /**
            Format integer time_ms to a nice string "HH:MM:SS"

            @param  {Integer}   time_ms     time in miliseconds
            @param  {Boolean}   decimal     display decimal time
            @param  {Boolean}   force_hours force hours, even if 00
        */
        formatTime: function (time_ms, decimal, force_hours) {
            var res = "",
                tim = decimal ? Math.floor(time_ms/1000) : Math.round(time_ms/1000);
            for(var i = 0; i < 2; i += 1) {
                if (res.length > 0) { res = ":" + res; }
                res = smile.util.pad(tim%60, 2) + res;
                tim = Math.floor(tim/60);
            }
            if (tim > 0 || force_hours) {
                res = smile.util.pad(tim, 2) + ":" + res;
            }
            if (decimal) {
                var st = '' + time_ms;
                res = res + '.' + (st).substr(st.length-3);
            }
            return res;
        },

        /**
            Pad string
            <p>
            e.g. pad(1, 2) -> "01"
            <p>
            pad(2,3,1) -> "112"
            <p>
            pad("lala", 6, " ", true) -> "lala  "

            @param  {String}    str         string to be padded
            @param  {Integer}   len         length to be reached
            @param  {String}    [chr]       character for filling empty spaces
            @param  {Boolean}   [append]    append instead of prepend characters
            @type   String
        */
        pad: function (str, len, chr, append) {
            if (chr === undefined) { chr = '0'; }
            var res = "" + str;
            for (var i = (""+str).length; i < len; i += 1) {
                if (append) {
                    res += chr;
                } else {
                    res = chr + res;
                }
            }
            return res;
        },

        parseRatio: function (str) {
            var ratio = null;
            str || (str = '');
            if (str.search('/') > -1) {
                str = str.split('/');
                ratio = parseFloat(str[0])/parseFloat(str[1]);
            } else if (str.search('%') > -1) {
                ratio = parseFloat(str)/100;
            } else if (str) {
                ratio = parseFloat(str);
            }
            return ratio;
        },

        addCssRule: function (selector, css) {
            if (document.styleSheets[0].addRule) document.styleSheets[0].addRule(selector, css);
            else if (document.styleSheets[0].insertRule) document.styleSheets[0].insertRule(selector+'{'+css+'}', 0);
        }

        
    };

    $.fn.dataObject = function (attrName) {
        return smile.util.parseObjectLiteral($(this).data(attrName));
    };


}(window, jQuery));
(function ($, mejs, smile) {

    /**
        Base Player (wraps mediaelement)

        Usage:
        
        Sources:
        extension   mimetype                source
        mp4         video/mp4               http://
        webm        video/webm              http://
        m3u8        application/x-mpegURL   http://
        flv         video/x-flv             http://
        wmv         video/x-ms-wmv          http://
        rtmp        video/rtmp              rtmp://

        Guidelines
        1. give video a unique id (and use it's prefix for track ids)
            tracks must have ids!
        2. first list rtmp sources, <video> will ignore them but flash will use them instead of http
        3. use .smile-player hideNativeTracks to hide native caption/subtitles rendering
            or use .smile-display onlyShim to only show display when native caption/subtitles aren't rendering

        @TODO firefox 31 THERE IS NO "load" EVENT ON <track> @FML

        Attributes:
        
        video
            poster              poster image
            controls            show controls ?
            preload             none|metadata|auto
            data-smile
                thumbnail       video thumbnail (as alternative to poster="" attribute) ?

        source
            type                source mimetype (see above)
            src                 source uri
            data-smile
                width
                height
                bitrate
                size

        track
            kind                subtitles|captions|chapters|metadata
            srclang             language
            src                 source uri (IE needs proper mimetype for this to work)
            id                  NEEDED for proper track functioning
            default             whether this is the default track (there can be only one per kind)

        .smile-display element inside .smile-player container
            data-smile
                display         type of display
                track           track id (can be without "-lang")
                autoLanguage    (default: true) will try to find trackId by appending '-lang' to id (useful for language changes in between playback)
                onlyShim        (default: false) will only show display if player is shimmed (not native) or texttracks are shimmed with native player
                                (useful for showing subtitles and/or captions only in setups where they aren't displayed natively)

        Example:
        <div class="smile-player" data-smile="">
            <video id="video1" width="480" height="360" poster="https://media.viidea.com/v003/f9/7fyy6jgpnjetxl2ysumv7tiicamiq3xs.jpg" controls="controls" preload="none" data-smile="thumbnail: 'https://media.viidea.com/v003/96/s3swkcyvy74yk4ldosjlm6oqqjtfu4xw.jpg'">
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4:v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4/v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4" />
                <source data-smile="width: 768, height: 576, bitrate: 947107, size: 241460369" type="video/rtmp" src="rtmp://maat2.viidea.com/vod/mp4:v003/49/jgm7sefrygoocade4vixah2buaszagkc.mp4" />
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="video/mp4" src="https://media.viidea.com/v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4" />
                <source data-smile="width: 640, height: 480, bitrate: 566891, size: 144526110" type="application/x-mpegURL" src="http://maat2.viidea.com/vod/_definst_/mp4:v003/6a/nkluipq7fxvi73nb5abkuclty36byp7g.mp4/playlist.m3u8" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="video/mp4" src="https://media.viidea.com/v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4" />
                <source data-smile="width: 480, height: 360, bitrate: 417220, size: 106368396" type="application/x-mpegURL" src="http://maat2.viidea.com/vod/_definst_/mp4:v003/76/ozanhot62etoaaophm2ttkqagt3dviys.mp4/playlist.m3u8" />
                <track kind="subtitles" src="subtitles.vtt" srclang="en" id="video1-track-subtitles-en" default="default" />
                <track kind="metadata" src="metadata.vtt" srclang="en" id="video1-track-slides-en" default="default" />
            </video>
            <div id="video1-slides" class="smile-display" data-smile="track: video1-track-slides, display: slides"></div>
            <div id="video1-subtitles" class="smile-display" data-smile="track: video1-track-subtitles, onlyShim"><div>
        </div>

        Source selection / bitrate switching:

        Current behaviour:
        if only rtmp:// is present, <video> will try to play it
            - ideally, flash player should be loaded
        if http:// sources are before rtmp, flash will load http://
            - ideally, rtmp sources should be played by default
            - ideally, rtmp bitrate swithing would happen inside flash engine?

        @param  node                        HTMLElement     media (video) HTML element
        @param  options                     Object
        @param  [options.regions]           Object          region id -> region class mapping

        Extensions:
        @param  [options.display]           Boolean         auto set up displays (default: true) 
        @param  [options.hideNativeTracks]  Boolean         hide native tracks (subtitles and captions)

        Events
        @event  load        mediaelement successfully loaded
        @event  error       mediaelement error when loading
        @event  loadtracks  tracks are loaded (either with error or not)

        @property   media   mediaelement API
        @property   $media  jquery wrapped dom node
        @property   container
    */
    smile.Player = function (node, options) {
        if (! (this instanceof smile.Player)) return new smile.Player(node, options);
        smile.util.bindAll(this, ['initializeDisplays', 'onMediaReady', 'onHandleError']);
        options || (options = {});
        this.smileReadyState = 1;

        // node is media element
        var $media = $(node),
            tagName = $media[0].tagName.toLowerCase(),
            that = this;
        if (tagName == 'video' || tagName == 'audio') {
            this.$media = $media;

        // node is parent of media element
        } else {
            $media = $($media.find('video,audio')[0]);
            if ($media.length && ['video', 'audio'].indexOf($media[0].tagName.toLowerCase()) > -1) {
                this.$media = $media;
                options.container = $(node);                
            }
        }
        if (!this.$media) throw new Error("Needs <video> or <audio> or an element containing one of those");
        this.media = this.$media[0];

        // player instance found
        if (typeof this.media.smile != 'undefined') {
            return this.media.smile;
        }
        this.media.smile = this;

        // container
        this.initializeContainer(options.container);

        // options
        this.options = $.extend({}, 
            this.constructor.defaults, 
            this.$media.dataObject('smile'),
            this.$container.dataObject('smile'),
            options);

        // when ready
        this.ready(function () {
            that.media.addEventListener('loadedmetadata', $.proxy(that.updateRatio, that));
            that.updateRatio();
        });

        // =======================
        // CONSTRUCT MEDIA ELEMENT
        mejs.MediaElement(this.$media[0], $.extend({}, this.options, {
            success: this.onMediaReady,
            error: this.onHandleError
        }));

        // extensions
        for (var option in this.options) {
            if (this.options.hasOwnProperty(option) && smile.Player.extensions[option]) {
                this.enableExtension(option);
            }
        }

        return this;
    };

    $.extend(smile.Player.prototype, EventDispatcher.prototype, {
        initializeContainer: function (container) {
            // container
            if (container) {
                this.$container = $(container);
            } else {
                this.$container = this.$media.closest('.smile-player');
                if (!this.$container.length) this.$container = this.$media;
            }
            this.container = this.$container[0];
            this.container.smile = this;
            this.$container.attr('id', (this.$media.attr('id')||'smile1')+'-container');
        },
        enableExtension: function (name) {
            var ext = smile.Player.extensions[name];
            $.extend(this, ext.methods);
            ext.initialize && ext.initialize.apply(this);
            ext.ready && this.ready($.proxy(ext.ready, this));
            ext.tracksReady && this.tracksReady($.proxy(ext.tracksReady, this));
        },
        onMediaReady: function (media, domNode) {
            var that = this;
            this.smileReadyState = 2;

            // set media
            this.media = media;
            this.media.smile = this;
          
            // dispatch load
            this.dispatchEvent({type: 'load', target: this});
            this._loadtracksFired = false;

            // hook tracks
            for (var i = 0; i < this.media.textTracks.length; i += 1) {
                this.media.textTracks[i].ready(function () {
                    if (!that._loadtracksFired && that.areTracksReady()) {
                        that._loadtracksFired = true;
                        that.dispatchEvent({type: 'loadtracks', target: that});
                    }
                });
            }
        },
        onHandleError: function (e) {
            this.smileReadyState = 3;
            this.dispatchEvent({type: 'error', error: e, target: this});
        },
        
        /**
            Call function when player is ready
        */
        ready: function (f) {
            // @TODO track ready?
            var that = this;
            if (this.smileReadyState === 2 || this.smileReadyState === 3) {
                setTimeout(f, 0);
            } else {
                var cb = function () {
                    that.removeEventListener('load', cb);
                    setTimeout(f, 0);
                }
                this.addEventListener('load', cb);
            }
            return this;
        },
        areTracksReady: function ()  {
            var tracks = this.$media.find('track');
            for (var i = 0; i < tracks.length; i += 1) {
                if (((tracks[i].readyState || tracks[i]._readyState)||0) < 2) return false;
            }
            return true;
        },

        /**
            Call function when player and tracks are ready
        */
        tracksReady: function (f) {
            var that = this;
            if (this.areTracksReady()) {
                setTimeout(f, 0);
            } else {
                var cb = function () {
                    that.removeEventListener('loadtracks', cb);
                    setTimeout(f, 0);
                }
                this.addEventListener('loadtracks', cb);
            }
            return this;
        },

        getVideoRatio: function () {
            var attrWidth = this.$media.attr('width'),
                attrHeight = this.$media.attr('height'),
                data = $.extend({}, this.$media.dataObject('smile'), this.$container.dataObject('smile')),
                ratio;
            if (this.media.videoWidth) ratio = this.media.videoWidth/this.media.videoHeight;
            else if (this._attrRatio) ratio = this._attrRatio;
            else if (attrWidth && attrHeight) {
                ratio = this._attrRatio = attrWidth/attrHeight;
                this.$media.attr({width: '', height: ''});
            } else if (data.ratio) ratio = smile.util.parseRatio(data.ratio);
            else ratio = this.$media.width()/this.$media.height();
            return ratio || (16/9);
        },

        updateRatio: function (ratio) {
            if (typeof ratio != 'number' || !ratio) ratio = this.getVideoRatio();
            smile.util.addCssRule('#'+this.$container.attr('id')+' .smile-area:after', 'padding-top: '+(100/ratio)+'%;');
        },

        /**
            Get tracks by id (without "-lang")

            @param  trackId     String      track id without -lang suffix
        */
        getTracksById: function (trackId) {
            var tracks = [],
                track;
            for (var i = 0; i < this.media.textTracks.length; i += 1) {
                track = this.media.textTracks[i];
                if (track.id == trackId + '-' + track.language) {
                    tracks.push(track);
                }
            }
            return tracks;
        },

        /**
            Get track by id

            @param  trackId     String      track id
            @param  autoLang    Boolean     if true will search for tracks without -lang suffix and will return the first with mode == 'showing'
        */
        getTrackById: function (trackId, autoLang) {
            var tracks = autoLang ? this.getTracksById(trackId) : this.media.textTracks,
                track,
                i;
            for (i = 0; i < tracks.length; i += 1) {
                track = tracks[i];
                if (autoLang && track.mode != 'disabled') return track;
                else if (!autoLang && track.id == trackId) return track;
            }
            if (autoLang && tracks.length) return tracks[0];
            return null;
        }
    });
    $.extend(smile.Player, {
        defaults: {
            // default options go here
        },
        extensions: {},
        registerExtension: function (name, obj) {
            this.extensions[name] = {
                initialize: obj.initialize,
                ready: obj.ready,
                tracksReady: obj.tracksReady,
                methods: obj
            };
            delete obj.initialize;
            delete obj.ready;
            delete obj.tracksReady;
        }
    });
    $.fn.smile = function (options) {
        $(this).each(function () {
            this.smile ||
                (this.smile = new smile.Player($(this), options));
        });
    };

    /**
        Determine which url to use
        @TODO put source selection logic here
        @TODO add support for returning list of url for bitrate switching (currently choosing just one)
        @TODO remember playback options somewhere on media for later usage (like media.pluginType which is already set)
    */
    var oldDeterminePlayback = mejs.HtmlMediaElementShim.determinePlayback;
    mejs.HtmlMediaElementShim.determinePlayback = function () {
        var data = oldDeterminePlayback.apply(this, arguments);
        return data;
    };

}(jQuery, mejs, smile));