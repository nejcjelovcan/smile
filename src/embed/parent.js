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
        this.uuid = 0;
        this._promises = {};

        this.options = options;
        this.initialize();
    };

    $.extend(smile.PostmessagePlayer.prototype, EventDispatcher.prototype, {
        initialize: function () {
            smile.util.bindAll(this, ['onWindowMessage']);

            this.targetOrigin = this.$node.attr('src').split('/').slice(0,3).join('/');
            this.id = 'smileEmbed' + (''+Math.random()).slice(2,8);
            $(window).on('message', this.onWindowMessage);

            var that = this;
            setTimeout(function () {
                that._postMessage({method: 'registerParent'});
            }, 1000);   // @TODO
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
        registerChild: function (args, source) {
            var smileReadyState = args[0],
                methods = args[1];

            this._setupMethods(this, methods);
        },
        _setupMethods: function (obj, methods, prefix) {
            var that = this, pk;
            $.each(methods, function (k, v) {
                if (v === true) {
                    obj[k] = function () {
                        var getter = k.substr(0,3) === 'get',
                            args = $.makeArray(arguments),
                            promise,
                            callback;
                        if (getter && args.length && $.isFunction(args[0])) {
                            callback = args[0];
                            args = args.slice(1);
                        }
                        console.log('LADIDA', getter, callback);
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
            var promise;
            if (callsBack) {
                this.uuid += 1
                data.uuid = this.uuid;
                promise = this._promises[data.uuid] = $.Deferred();
            }
            this.node.contentWindow.postMessage(JSON.stringify(data), this.targetOrigin);
            return promise;
        },

    });

}(jQuery, smile));
