(function ($, mejs, smile) {
    smile.Player.registerExtension('controls', {
        initialize: function () {
            this._controls = { container: this.$container.find('.smile-controls') };
            this._controls.container[0].smile = this;
        },
        ready: function () {
            var player = this,
                ctrl = this._controls,
                setPlayButton = function (state) {
                    ctrl.container.find('.smile-button-play')
                        .removeClass('play pause')
                        .addClass(state);
                    ctrl.container.find('.smile-button-play i')
                        .removeClass('fa-play fa-pause')
                        .addClass('fa-'+state);
                },
                setVolumeButton = function () {
                    var cls = 'vol3';
                    if (player.media.muted) cls = 'vol0';
                    else {
                        if (player.media.volume < 0.66) cls = 'vol2';
                        if (player.media.volume < 0.33) cls = 'vol1';
                        if (player.media.volume == 0) cls = 'vol0';
                    }
                    
                    ctrl.container.find('.smile-button-volume')
                        .removeClass('vol0 vol1 vol2 vol3')
                        .addClass(cls);
                    ctrl.container.find('.smile-volume-progress-bar')
                        .css('width', (player.media.muted?0:(player.media.volume*100))+'%');
                    ctrl.container.find('.smile-button-volume i')
                        .removeClass('fa-volume-up fa-volume-down fa-volume-off')
                        .addClass(cls == 'vol0' ? 'fa-volume-off' : (cls == 'vol3' ? 'fa-volume-up' : 'fa-volume-down'));
                },
                setFullscreenButton = $.delay(100, function (event) {
                    var fs = document.fullScreen||document.mozFullScreen||document.webkitIsFullScreen;
                    ctrl.container.find('.smile-button-fullscreen')
                        .removeClass('open close')
                        .addClass(fs ? 'close' : 'open');
                    ctrl.container.find('.smile-button-fullscreen i')
                        .removeClass('fa-expand fa-compress')
                        .addClass(fs ? 'fa-compress' : 'fa-expand');
                }),
                getNearestBuffer = function () {
                    var i;
                    for (i = player.media.buffered.length-1; i >= 0; i -= 1) {
                        if (player.media.buffered.start(i) < player.media.currentTime) return i;
                    }
                    return 0;
                },
                setTimeProgress = function () {
                    if (!player.media.duration) return;
                    var bufferEnd = player.media.buffered.length &&
                            player.media.buffered.end(getNearestBuffer()),
                        currentTime = player.media.currentTime,
                        duration = player.media.duration;
                    ctrl.container.find('.smile-time-display')
                        .text(smile.util.formatTime(currentTime*1000));
                    ctrl.container.find('.smile-time-progress-bar')
                        .css('width', ((currentTime/duration)*100)+'%');
                    ctrl.container.find('.smile-time-progress-buffer')
                        .css('width', (bufferEnd && bufferEnd > currentTime ?
                            (bufferEnd-currentTime)/duration : 0)*100 + '%')
                },
                getProgressFromPosition = function (event, progress) {
                    var prog = (event.pageX-progress.offset().left)/progress.width();
                    if (prog < 0) prog = 0;
                    if (prog > 1) prog = 1;
                    return prog;
                };
            this.media.addEventListener('timeupdate', function () {
                setTimeProgress();
            });
            this.media.addEventListener('playing', function () {
                setPlayButton('pause');
                setVolumeButton();
                setTimeProgress();
            });
            this.media.addEventListener('waiting', function () {
                setPlayButton('pause');
            });
            this.media.addEventListener('pause', function () {
                setPlayButton('play');
            });
            this.media.addEventListener('ended', function () {
                setPlayButton('play');
            });
            this.media.addEventListener('volumechange', function () {
                setVolumeButton();
            });
            this.media.addEventListener('progress', function () {
                setTimeProgress();
            });

            ctrl.container.on('click', '.smile-button-play.play', function (event) {
                player.media.play();
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-play.pause', function (event) {
                player.media.pause();
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-volume', function (event) {
                player.media.setMuted(!player.media.muted);
                event.preventDefault();
            });
            ctrl.container.on('click', '.smile-button-fullscreen,.smile-button-fullscreen.open', function (event) {
                event.preventDefault();
                if (player.container.webkitRequestFullScreen) player.container.webkitRequestFullScreen();
                else if (player.container.mozRequestFullScreen) player.container.mozRequestFullScreen();
                else if (player.container.requestFullscreen) player.container.requestFullscreen();
                else if (player.container.requestFullScreen) player.container.requestFullScreen();
            });
            ctrl.container.on('click', '.smile-button-fullscreen.close', function (event) {
                event.preventDefault();
                if (document.cancelFullScreen) document.cancelFullScreen();
                else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                else if (document.exitFullscreen) document.exitFullscreen();
            });
            ctrl.container.on('mouseup', '.smile-time-progress', function (event) {
                if (!player.media.duration) return;
                var progress = getProgressFromPosition(event, ctrl.container.find('.smile-time-progress'));
                player.media.setCurrentTime(progress*player.media.duration);
            });
            ctrl.container.on('mouseup', '.smile-volume-progress', function (event) {
                if (player.media.muted) return;
                var progress = getProgressFromPosition(event, ctrl.container.find('.smile-volume-progress'));
                player.media.setVolume(progress);
            });

            document.addEventListener("fullscreenchange", setFullscreenButton);
            document.addEventListener("webkitfullscreenchange", setFullscreenButton);
            document.addEventListener("mozfullscreenchange", setFullscreenButton);

            setPlayButton('play');
            setFullscreenButton();

            ctrl.resize = function () {
                player.$container.find('.smile-media, .smile-area, video')
                    .css('max-height', ($(window).height()-40)+'px');
            };
            ctrl.resize();
            this.addEventListener('resize', ctrl.resize);
        }
    });
}(jQuery, mejs, smile));