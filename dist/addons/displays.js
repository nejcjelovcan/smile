(function ($, smile) {

    smile.Player.registerExtension('displays', {
        initialize: function () {
            smile.util.bindAll(this, ['resize']);
        },
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
        },
        resize: function (event) {
            $.each(this.displays||[], function (i, display) {
                if (display.resize) display.resize();
            });
        }
    });

    /**
        Display
        If you want to hide it, use track.setMode('disabled') - mode 'hidden' is used for hiding native renderers
            if you still need the track to fire, just hide container
        Will toggle .active class on cue views
        By default will also toggle display css property (except if options.toggleDisplay == false)
        
        Also, all <*> elements in display container with data-time="" value will seek video position on button click

        @param  options                     Object
        @param  options.container           HTMLElement|jQuery  container element
        @param  options.player              smile.Player        player instance
        @param  options.track               smile.Track         track instance
        @param  options.toggleDisplay       Boolean             whether to toggle display when cue is active/inactive (defaul: true; otherwise only active class gets toggled)
        @param  options.visibleOnCue        Boolean             whether to hide display when no cue is active
        @param  options.onlyShim            Boolean             only show display when shim is active (default: false)
                                                            (shim is active means that both media element is native and track support is native)
        @param  options.autoLanguage        Boolean             automatically handle language change (default: true)
    */
    smile.Display = function (options) {
        if (!options.container) throw new Error("Display needs container");
        this.$container = $(options.container);
        this.$container[0].smileDisplay = this;
        this.player = options.player;
        this.cues = {};
        this.visibleOnCue = options.visibleOnCue || false;
        this.toggleDisplay = typeof options.toggleDisplay == 'undefined' ? true : !!options.toggleDisplay;
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
            smile.Display.hookTimeLinkEvents(this.$container, this.player);
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
                show = false,
                toggleDisplay = this.toggleDisplay,
                activeIds = $.map(this.track.activeCues||[], function (cue) {
                    return trackId + '-cue-' + cue.id;
                });
            if (this.visibleOnCue) this.$container[activeIds.length ? 'show' : 'hide']();
            // show active cues / hide inactive
            this.$container.find('.smile-cue').each(function () {
                show = activeIds.indexOf($(this).attr('id')) > -1;
                $(this).toggleClass('active', show);
                if (toggleDisplay) $(this).toggle(show);
            });
        },
        resize: function () {
        },
        getRatio: function () {
            return 4/3;
        }
    });
    
    smile.Display.hookTimeLinkEvents = function (container, player) {
        container.find('*[data-time]').each(function () {
            var $el = $(this), time = parseFloat($el.attr('data-time'))+0.1;
            $el.on('click', function (event) {
                event.preventDefault();
                player.media.setCurrentTime(time);
            });
        });
    };

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
        this._ratio = 4/3;
    };
    $.extend(smile.DisplaySlides.prototype, smile.Display.prototype, {
        renderCue: function (cue) {
            var cueData = JSON.parse(cue.text),
                cueView = smile.Display.prototype.renderCue.apply(this, [cue]);
            cueView.el.empty().append($('<img>').attr({src: cueData.images[0].src, title: cueData.title}));
            return cueView;
        },
        render: function () {
            smile.Display.prototype.render.apply(this);
            var ratios = [],
                cueData;
            for (var i = 0; i < this.track.cues.length; i += 1) {
                cueData = JSON.parse(this.track.cues[i].text);
                if (cueData.images && cueData.images.length) {
                    if (cueData.images[0].width && cueData.images[0].height) {
                        ratios.push(cueData.images[0].width/cueData.images[0].height)
                    }
                }
            }

            if (ratios.length) {
                ratios.sort(function (a, b) { return a - b; });
                this._ratio = ratios[Math.floor(ratios.length/2)];
            }
        },
        getRatio: function () {
            return this._ratio;
        }
    });

}(jQuery, smile));