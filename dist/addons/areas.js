(function ($, mejs, smile) {

    /**
        Modes:
        1. fixed ratio (.smile-area-wrapper data-smile="ratio: 9/16")
            with fixed ratio there needs to be a way to tell which area has precedence over real estate
        2. dynamic ratio (opt. minimum-maximum) (.smile-area-wrapper data-smile="max-ratio: 20/16, min-ratio:9/16")
        a. fixed width ratio (.smile-area width="80%")
        b. dynamic width ratio

        @TODO
            forced video positioning needed for
            fixed ratio + fixed width ratio not working correctly
            minimum & maximum
    */
    smile.Player.registerExtension('areas', {
        initialize: function () {
            var container = this.$container.find('.smile-area-wrapper'),
                data = container.dataObject('smile'),
                areaSize = {
                    ratio: 1,
                    fixedWidthRatio: false,
                    widthRatio: 0.5
                },
                areas = {
                    container: container,
                    area1: $(container.find('.smile-area')[0]),
                    area2: $(container.find('.smile-area')[1]),
                    sizes: {
                        ratio: 2,
                        fixedRatio: false,
                        minRatio: null, maxRatio: null,
                        area1: $.extend({}, areaSize),
                        area2: $.extend({}, areaSize)
                    }
                },
                val;
            this._areas = areas;
            if (!areas.area2.length) areas.area2 = null;

            // determine fixed ratio
            val = smile.util.parseRatio(data.ratio);
            if (val) {
                areas.sizes.fixedRatio = true;
                areas.sizes.ratio = val;
            }
            if (data.minRatio) areas.sizes.minRatio = data.minRatio;
            if (data.maxRatio) areas.sizes.maxRatio = data.maxRatio;

            // determine fixed width ratios
            if (areas.area2) {
                val = smile.util.parseRatio(areas.area1.attr('width'));
                if (val) {
                    this.setWidthRatio(val);
                    areas.sizes.area1.fixedWidthRatio = true;
                } else {
                    val = smile.util.parseRatio(areas.area2.attr('width'));
                    if (val) {
                        this.setWidthRatio(null, val);
                        areas.sizes.area2.fixedWidthRatio = true;
                    }
                }
            } else if (areas.sizes.fixedRatio) {
                areas.sizes.area1.ratio = areas.sizes.ratio;
            }

        },
        ready: function () {
        },
        tracksReady: function () {
            this.updateRatio();
        },
        /**
            Thing is, you only do this when ratios change (not window resize :D)
        */
        updateRatio: function (ratio) {
            var videoSize = {
                    ratio: this.getVideoRatio()
                },area2Size = {
                    ratio: this.getArea2Ratio()
                };
            this.setAreaSizes(videoSize, area2Size);
            this.updateAreaView();
            this.dispatchEvent({type: 'updateratio', ratio: this._areas.sizes.ratio});
        },
        updateSize: function () {
            var embed = this.$container.find('embed');
            if (embed.length) {
                var w = this._areas.area1.width(),
                    h = w*(1/this.getVideoRatio());
                this.media.setVideoSize(w, h);
            }
        },
        getArea2Ratio: function () {
            var display = this._areas.area2[0].smileDisplay;
            if (display && display.getRatio) {
                return display.getRatio();
            }
            return 4/3;
        },
        /**
            Switch left and right area
        */
        switchAreas: function () {
            var left = this._areas.container.find('.smile-left'),
                right = this._areas.container.find('.smile-right');
            left.removeClass('smile-left').addClass('smile-right');
            right.removeClass('smile-right').addClass('smile-left');
        },
        updateAreaView: function () {
            var areas = this._areas,
                ratio = areas.sizes.ratio;

            smile.util.addCssRule('#'+this.$container.attr('id')+' .smile-area-wrapper:after',
                'padding-top: '+(100/ratio)+'%;');
            areas.area1.width((areas.sizes.area1.widthRatio*100)+'%');
            if (areas.area2) areas.area2.width((areas.sizes.area2.widthRatio*100)+'%');
        },
        setAreaSizes: function (area1size, area2size) {
            var areas = this._areas;
            $.extend(areas.sizes.area1, {
                width: area1size.width,
                height: area1size.height,
                ratio: (area1size.width/area1size.height) || area1size.ratio || areas.sizes.area1.ratio
            });
            $.extend(areas.sizes.area2, {
                width: area2size.width,
                height: area2size.height,
                ratio: (area2size.width/area2size.height) || area2size.ratio || areas.sizes.area2.ratio
            });

            var ratio, area1ratio, area2ratio;

            // only one area
            if (!areas.area2) {
                ratio = area1ratio = areas.sizes.area1.ratio;
                area2ratio = 0;

            // we have a fixed ratio
            } else if (areas.sizes.fixedRatio) {
                ratio = areas.sizes.ratio;

                // fixed width ratio
                if (areas.sizes.area1.fixedWidthRatio||areas.sizes.area2.fixedWidthRatio) {
                    area1ratio = areas.sizes.area1.widthRatio*ratio;
                    area2ratio = areas.sizes.area2.widthRatio*ratio;

                // determining ratio from size
                } else if (area2size.width) {
                    area1ratio = areas.sizes.area1.ratio;
                    area2ratio = ratio - area1ratio;
                } else {
                    area2ratio = areas.sizes.area2.ratio;
                    area1ratio = ratio - area2ratio;
                }

            // no ratio yet
            } else {
                area1ratio = areas.sizes.area1.ratio;
                area2ratio = areas.sizes.area2.ratio;

                // one area has fixed width ratio
                if (areas.sizes.area1.fixedWidthRatio) {
                    ratio = area2ratio/(1-areas.sizes.area1.widthRatio);
                    area1ratio = ratio - area2ratio;
                } else if (areas.sizes.area2.fixedWidthRatio) {
                    ratio = area1ratio/(1-areas.sizes.area2.widthRatio);
                    area2ratio = ratio - area1ratio;

                // plain dynamic ratio
                } else {
                    ratio = area1ratio + area2ratio;
                }

                // ratio out of maximum/minimum
                if ((areas.sizes.maxRatio && ratio > areas.sizes.maxRatio)
                    || (areas.sizes.minRatio && ratio < areas.sizes.minRatio)) {
                    ratio = (areas.sizes.maxRatio && ratio > areas.sizes.maxRatio) ? areas.sizes.maxRatio : areas.sizes.minRatio;
                    if (area1ratio.width) {
                        area2ratio = ratio - area1ratio;
                    } else {
                        area1ratio = ratio - area2ratio;
                    }
                }
            }


            if (area1ratio + area2ratio != ratio) throw new Error("Area ratios don't match"); // @DEBUG
            this.setWidthRatio(area1ratio/ratio);
            this.setAreaRatios(area1ratio, area2ratio);
        },
        setAreaRatios: function (area1ratio, area2ratio) {
            var areas = this._areas;
            $.extend(areas.sizes, {
                ratio: area1ratio + area2ratio
            });
            $.extend(areas.sizes.area1, {
                ratio: area1ratio,
                widthRatio: area1ratio/areas.sizes.ratio
            });
            $.extend(areas.sizes.area2, {
                ratio: area2ratio,
                widthRatio: area2ratio/areas.sizes.ratio
            });
        },
        setWidthRatio: function (area1wr, area2wr) {
            if (!area1wr) {
                this._areas.sizes.area2.widthRatio = area2wr;
                this._areas.sizes.area1.widthRatio = 1-area2wr;
            } else {
                this._areas.sizes.area1.widthRatio = area1wr
                this._areas.sizes.area2.widthRatio = 1-area1wr;
            }
        },
    });

}(jQuery, mejs, smile));
