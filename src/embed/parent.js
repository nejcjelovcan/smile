(function ($, smile) {

    smile.PostmessagePlayer = function (node, options) {
        node = $(node)[0];
        var tagName = node.tagName.toLowerCase();
        if (tagName == 'iframe') {
            this.node = node;

        // node is parent of iframe element
        } else {
            node = $($(node).find('iframe')[0])[0];
            if (node) {
                this.node = node;
            }
        }

        if (!this.node) throw new Error("Needs <iframe> or an element containing one");
        this.$node = $(this.node);
        this.$node.attr({mozallowfullscreen: 1, webkitallowfullscreen: 1, scrolling: 'no'});
        this.uuid = 0;
        this._promises = {};

        this.options = options;
        this.initialize();
    };

    $.extend(smile.PostmessagePlayer.prototype, EventDispatcher.prototype, {
        initialize: function () {
            smile.util.bindAll(this, ['onWindowMessage', 'onUpdateRatio', 'onResize']);

            this.targetOrigin = smile.util.cleanUrl(this.$node.attr('src'), true)||smile.util.cleanUrl(document.location.href, true);
            this.id = this.$node.attr('id')||('smileEmbed' + (''+Math.random()).slice(2,8));
            this.$container = this.$node.parent();
            if (!this.$container.hasClass('smile-embed')) {
                this.$container = $('<div>').addClass('smile-embed').append(this.$node).appendTo(this.$container);
            }
            this.$container.attr('id', this.id+'-container');
            $(window).on('message', this.onWindowMessage);
            this.addEventListener('updateratio', this.onUpdateRatio);

            var that = this;
            that._postMessage({method: 'registerParent'});
            this.$node.load(function() {
                that._postMessage({method: 'registerParent'});
            });

            $(window).resize($.debounce(250, this.onResize));
        },
        onWindowMessage: function (event) {
            var data, dispatch;
            try { data = JSON.parse(event.originalEvent.data); }
            catch (e) { return; }

            if (data.method == 'registerChild') {
                this.registerChild(data.args, event.originalEvent.source);
            } else if (data.method == 'event') {
                dispatch = this.dispatchEvent;
                data.args[0].target = this
                if (data.prefix) {
                    data.args[0].target = this[data.prefix];
                    dispatch = this[data.prefix].dispatchEvent;
                }
                dispatch.call(data.args[0].target, data.args[0]);
            } else if (data.method == 'callback') {
                if (this._promises[data.uuid]) {
                    this._promises[data.uuid].resolve.apply(this._promises[data.uuid], data.args);
                }
            }
        },
        onUpdateRatio: function (e) {
            // @TODO we get ratio of video only (controls aren't counted!)
            this._lastRatio = (e && e.ratio) || this._lastRatio;
            if (!this._lastRatio) return;
            var w = this.$node.width(),
                ratio = w/((w/this._lastRatio) + 40); /* controls height */
            smile.util.addCssRule('#'+this.$container.attr('id')+':after', 'padding-top: '+(100/ratio)+'%;');
        },
        onResize: function () {
            this.onUpdateRatio();
        },
        registerChild: function (args, source) {
            var smileReadyState = args[0],
                ratio = args[1];
                methods = args[2];

            this._setupMethods(this, methods);
            if (ratio) {
                this.onUpdateRatio({ratio: ratio});
            }
        },
        _setupMethods: function (obj, methods, prefix) {
            var that = this, pk;
            $.each(methods, function (k, v) {
                if (v === true) {
                    obj[k] = function () {
                        var getter = k.substr(0,3) === 'get' || k.substr(0,3) === 'can',
                            args = $.makeArray(arguments),
                            promise,
                            callback;
                        if (getter && args.length && $.isFunction(args[0])) {
                            callback = args[0];
                            args = args.slice(1);
                        }
                        promise = that._postMessage({method: (prefix||'')+k, args: args}, getter);
                        if (getter && promise && callback) promise.done(callback);
                        return promise;
                    }
                } else {
                    obj[k] = new EventDispatcher;
                    that._setupMethods(obj[k], v, k+'.');
                }
            });
        },

        _postMessage: function (data, callsBack) {
            // @TODO remember postmessage history while .postmessageSource is null
            var promise, that = this;
            if (callsBack) {
                this.uuid += 1
                data.uuid = this.uuid;
                promise = this._promises[data.uuid] = $.Deferred();
                promise.done(function () { delete that._promises[data.uuid]; })
            }
            this.node.contentWindow.postMessage(JSON.stringify(data), this.targetOrigin);
            return promise;
        }

    });

}(jQuery, smile));
