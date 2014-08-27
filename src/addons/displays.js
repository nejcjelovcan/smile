(function ($, smile) {

    smile.Player.registerExtension('displays', {
        ready: function () {
            var that = this;
            this.displays = [];
            this.$container.find('.smile-display').each(function () {
                var data = $(this).dataObject('smile'),
                    clsName = 'Display',
                    cls = smile.Display;
                if (data.track) {
                    if (data.display) {
                        clsName = 'Display' + smile.util.capitalize(data.display);
                    }
                    cls = smile[clsName];
                    if (!cls) {
                        console.warn('Smile display expects valid display type: smile.'+clsName+' not found');
                    } else {
                        data.track = that.getTrackById(data.track) || that.getTrackById(data.track, true);
                        data.container = $(this);
                        data.player = that;
                        // other options are also in data (e.g. onlyTrackshim and autoLanguage)
                        that.displays.push(new cls(data));
                    }
                } else {
                    console.warn('Smile display expects track parameter');
                }
            });
        }
    });

    /**
        Display
        if you want to hide it, use track.setMode('disabled') - mode 'hidden' is used for hiding native renderers
            if you still need the track to fire, just hide container

        @param  options                 Object
        @param  options.container       HTMLElement|jQuery  container element
        @param  options.player          smile.Player        player instance
        @param  options.track           smile.Track         track instance
        @param  options.visibleOnCue    Boolean             wether to hide display when no cue is active
        @param  options.onlyShim        Boolean             only show display when shim is active (default: false)
                                                            (shim is active means that both media element is native and track support is native)
        @param  options.autoLanguage    Boolean             automatically handle language change (default: true)
    */
    smile.Display = function (options) {
        if (!options.container) throw new Error("Display needs container");
        this.$container = $(options.container);
        this.$container[0].smileDisplay = this;
        this.player = options.player;
        this.cues = {};
        this.visibleOnCue = options.visibleOnCue || false;
        if (this.visibleOnCue) this.$container.hide();
        this.onlyShim = options.onlyShim || false;
        this.autoLanguage = typeof options.autoLanguage == 'undefined' ? true : options.autoLanguage;
        smile.util.bindAll(this, ['render', 'onModeChange', 'onCueChange']);
        if (options.track) this.setTrack(options.track);
    };
    $.extend(smile.Display.prototype, EventDispatcher.prototype, {
        setTrack: function (track) {
            var show = (!this.onlyShim) || (this.player.media.pluginType != 'native' || window.TextTrack.shim);
            if (this.track) this.unhookTrack();
            this.cues = {};
            this.track = track;
            if (show) {
                this.track.ready(this.render);
                this.hookTrack();
                this.onCueChange();
            }
        },
        hookTrack: function () {
            this.track.addEventListener('cuechange', this.onCueChange);
            this.track.addEventListener('modechange', this.onModeChange);
        },
        unhookTrack: function () {
            this.track.removeEventListener('cuechange', this.onCueChange);
            this.track.removeEventListener('modechange', this.onModeChange);
        },
        render: function (i,j) {
            var currentTime = this.player.media.currentTime,
                that = this,
                cue;
            if (this.track.mode == 'disabled') return;
            for (i = i || 0; i < (j || this.track.cues.length); i += 1) {
                cue = this.track.cues[i];
                if (!this.cues[cue.id]) {
                    this.cues[cue.id] = this.renderCue(cue);
                }
            }
        },
        renderCue: function (cue) {
            return { 
                el: $('<div>').addClass('smile-cue')
                    .append(cue.text.replace('\n', '<br/>'))
                    .attr('id', this.track.id+'-cue-'+cue.id)
                    .hide()
                    .appendTo(this.$container)
            };
        },
        onModeChange: function () {
            if (this.track.mode == 'showing' || this.track.mode == 'hidden') {
                this.$container.show();
            } else {
                this.$container.hide();
            }
            if (this.autoLanguage && this.track.mode == 'disabled') {
                var that = this, spl = this.track.id.split('-'),
                    trackId = spl.slice(0, spl.length-1).join('-');
                // wait till modes on tracks are set (@TODO defer?)
                setTimeout(10, function () {
                    that.setTrack(that.player.getTrackById(trackId, true));
                });
            } else {
                this.render();
            }
        },
        onCueChange: function () {
            var trackId = this.track.id,
                activeIds = $.map(this.track.activeCues||[], function (cue) {
                    return trackId + '-cue-' + cue.id;
                });
            if (this.visibleOnCue) this.$container[activeIds.length ? 'show' : 'hide']();
            // show active cues / hide inactive
            this.$container.find('.smile-cue').each(function () {
                $(this).toggle(activeIds.indexOf($(this).attr('id')) > -1);
            });
        }
    });
    
    /**
        DisplaySlides

        expects cue format:
        {
            images: [{src: width: height: }]
            title:
            text: 
        }

        @TODO dynamic render (only add certain amount of near images to DOM)
    */
    smile.DisplaySlides = function (options) {
        smile.Display.apply(this, [options]);
    };
    $.extend(smile.DisplaySlides.prototype, smile.Display.prototype, {
        renderCue: function (cue) {
            var cueData = JSON.parse(cue.text),
                cueView = smile.Display.prototype.renderCue.apply(this, [cue]);
            cueView.el.empty().append($('<img>').attr({src: cueData.images[0].src, title: cueData.title}));
            return cueView;
        }
    });

}(jQuery, smile));