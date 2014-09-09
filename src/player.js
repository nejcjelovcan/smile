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
            or use .smile-display hideIfNative to only show display when native caption/subtitles aren't rendering

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
        @event  load            mediaelement successfully loaded
        @event  error           mediaelement error when loading
        @event  loadtracks      tracks are loaded (either with error or not)
        @event  resize          player (window) resized
        @event  statechange     state changed (see state property)

        @property   media       mediaelement API
        @property   $media      jquery wrapped video node
        @property   container   container node
        @property   $container  jquery wrapped container node
        @property   state       video state     'initializing'|'ready'|'playing'|'waiting'|'pause'|'ended'
    */
    smile.Player = function (node, options) {
        if (! (this instanceof smile.Player)) return new smile.Player(node, options);
        smile.util.bindAll(this, ['initializeDisplays', 'onMediaReady', 'onHandleError', 'resize']);
        options || (options = {});
        this.smileReadyState = 1;
        this.state = 'initializing';

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

        function setState (state) {
            return function () {
                that.state = state;
                that.dispatchEvent({type: 'statechange', state: state});
            };
        }

        // when ready
        this.ready(function () {
            setState('ready')();
            that.media.addEventListener('loadedmetadata', $.proxy(that.updateRatio, that));
            that.media.addEventListener('playing', setState('playing'));
            that.media.addEventListener('waiting', setState('waiting'));
            that.media.addEventListener('pause', setState('pause'));
            that.media.addEventListener('ended', setState('ended'));
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

        $(window).resize($.debounce(500, this.resize));
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

        resize: function () {
            this.dispatchEvent({type: 'resize'});
            return this;
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
            smile.util.addCssRule('#'+this.$container.attr('id')+' .smile-media:after', 'padding-top: '+(100/ratio)+'%;');
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