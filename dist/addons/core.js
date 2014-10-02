(function ($, mejs, smile){
    smile.Player.registerExtension('hideNativeTracks', {
        ready: function () {
            this.hideNativeTracks();
        },
        hideNativeTracks: function () {
            var that = this;
            $.each(that.media.textTracks, function (i, track) {
                if (track.kind == 'subtitles' || track.kind == 'captions') {
                    track.setMode('hidden');
                }
            });
        }
    });

    smile.Player.registerExtension('css', {
        initialize: function () {
            // css stuff
            var features = mejs.MediaFeatures;
            this.$container.addClass(
                'smile-player smile-initial ' +
                (features.isAndroid ? 'smile-android ' : '') +
                (features.isiOS ? 'smile-ios ' : '') +
                (features.isiPad ? 'smile-ipad ' : '') +
                (features.isiPhone ? 'smile-iphone ' : '') +
                (window.TextTrack.shim ? 'smile-trackshim ' : '')
            );
        },
        ready: function () {
            var that = this,
                playbackStates = 'smile-playing smile-paused smile-waiting smile-ended smile-initial',
                toggleStateClass = function (state) {
                    return function () {
                        that.$container.removeClass(playbackStates).addClass(state);
                    }
                };
            this.$container.addClass('smile-plugin-'+this.media.pluginType);
            this.media.addEventListener('playing', toggleStateClass('smile-playing'));
            this.media.addEventListener('pause', toggleStateClass('smile-paused'));
            this.media.addEventListener('ended', toggleStateClass('smile-ended'));
            this.media.addEventListener('waiting', toggleStateClass('smile-waiting'));
        }
    });
}(jQuery, mejs, smile));
