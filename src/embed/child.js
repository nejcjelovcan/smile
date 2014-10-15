(function ($, smile) {


/*

    For player events (EventDispatcher prototype), we signal via postmessage
    with dispatchEvent overload. (For media we hook to all known events in _proxyMediaEvents)
    To make this more usable, certain events should be dispatched on player
    (e.g. fullscreenchange with custom prefixes)

*/

    var earlyOnWindowMessages = [],
        earlyOnWindowMessage = function (e) {
            earlyOnWindowMessages.push(e);
        };
    $(window).on('message', earlyOnWindowMessage);

    smile.Player.registerExtension('postMessage', {
        initialize: function () {
            smile.util.bindAll(this, ['onWindowMessage', '_cleanObject']);

            this.postMessage = {
                readyState: 1,
                source: null,   // @TODO determining target origin can fail!!! - must show warning on console that postmessage API is down!
                targetOrigin: this._determineTargetOrigin(typeof this.options.postMessage === 'boolean' ? '*' : this.options.postMessage)
            };

            // no need to filter events, we assume only one video in the child (i.e. iframe content document has only one video in DOM)
            $(window).on('message', this.onWindowMessage);

            this._proxyMediaEvents();
            $.map(earlyOnWindowMessages, this.onWindowMessage);
        },

        /**
            Event data is expected to be string of JSON:
            {   method: 'nameOfTheMethod',
                args: [ ... ],
                uuid: 'xyz' }   // if uuid present, callback can be provided
            {   method: 'event',
                args: [ event ] }
            {   method: 'callback',
                uuid: 'xyz',
                args: [ ... ] }
        */
        onWindowMessage: function (event) {
            var data;
            try { data = JSON.parse(event.originalEvent.data); }
            catch (e) { return; }

            if (data.method == 'registerParent') {
                this.registerParent(data.args, event.originalEvent.source);
                // ignore data.args with registerParent call (for now?)
            } else {
                var method = data.method.split('.'),
                    f = this,
                    name, that, result;
                // .media.someMethod will also work! :D
                while (method.length) { // @TODO errors
                    name = method.shift();
                    that = f;
                    f = f[name];
                }
                if ($.isFunction(f)) {
                    result = f.apply(that, data.args);
                } else {
                    if (typeof f != 'undefined') result = f;
                    else {
                        if (name.substr(0,3) == 'get') {
                            result = that[name.substr(3,1).toLowerCase()+name.substr(4)];
                        }
                    }
                }
                if (data.uuid) { // callback
                    this._postMessage({
                        method: 'callback',
                        uuid: data.uuid,
                        args: [typeof result == 'object' && result !== null ? this._cleanObject(result) : result]
                    });
                }
            }
        },

        registerParent: function (args, source) {
            // {a: true, b: {a: true}};
            var methods = this._scanMethods(this, ['media']);
            this.postMessage.source = source;

            this._postMessage({
                method: 'registerChild',
                args: [this.smileReadyState, methods]
            });
        },

        dispatchEvent: function () {
            var args = $.makeArray(arguments),
                result = smile.Player.prototype.dispatchEvent.apply(this, args);
            if (this.postMessage.source) {
                this._postMessage({
                    method: 'event',
                    prefix: '',
                    args: $.map(args, this._cleanObject)
                });
            }
            return result;
        },

        _proxyMediaEvents: function () {
            var events = ['waiting', 'volumechange', 'toggle', 'timeupdate', 'suspend', 'stalled', 'seeking', 'seeked',
                'ratechange', 'progress', 'playing', 'play', 'pause', 'loadstart', 'loadedmetadata', 'loadeddata', 'load',
                'ended', 'durationchange', 'cuechange', 'canplaythrough', 'canplay', 'webkitfullscreenerror', 'webkitfullscreenchange'],
                that = this;
            $.each(events, function (i, event) {
                that.media.addEventListener(event, function () {
                    that._postMessage({
                        method: 'event',
                        prefix: 'media',
                        args: $.map($.makeArray(arguments), that._cleanObject)
                    })
                });
            });
        },

        _scanMethods: function (obj, props) {
            var methods = {}, k, v, el = $('<div>')[0];
            props || (props = []);
            for (k in obj) {
                v = obj[k];
                if (k.substr(0,1) == '_' || k.substr(0,2) == 'on' || k.substr(0,6) == 'webkit' || k.substr(0,3) == 'moz' || k == 'registerParent' || k == 'apply'
                    || k == 'dispatchEvent' || k == 'addEventListener' || k == 'removeEventListener') {
                    // private or callback - starts with _ or 'on'
                } else if (v == HTMLElement.prototype[k] || v == Element.prototype[k] || v == Node.prototype[k]) {
                    // node method
                } else if (HTMLVideoElement[k] !== undefined || HTMLElement[k] !== undefined || Element[k] !== undefined || Node[k] !== undefined || el[k] !== undefined) {
                    // video node property
                } else if ($.isFunction(v)) {
                    methods[k] = true;
                } else if (['string', 'number', 'boolean'].indexOf(typeof v) > -1) {
                    methods['get'+k.substr(0,1).toUpperCase()+k.substr(1)] = true;
                } else if (v && props.indexOf(k) > -1) {
                    methods[k] = this._scanMethods(v, props);
                }
            }
            return methods;
        },

        _postMessage: function (data) {
            if (!this.postMessage.source) return;
            // @TODO remember postmessage history while .postmessageSource is null
            return this.postMessage.source.postMessage(JSON.stringify(data), this.postMessage.targetOrigin);
        },

        _determineTargetOrigin: function (origins) {
            origins = origins ? ($.isArray(origins) ? origins : [origins]) : [];
            var referrer = document.referrer || '',
                cleanReferrer = this._cleanUrl(referrer),
                cleanOrigins = $.map(origins, this._cleanUrl),
                targetOrigin;

            if (origins.indexOf('*') > -1 || $.map(cleanOrigins, function (orig) { return orig == cleanReferrer; }).indexOf(true) > -1) {
                targetOrigin = this._cleanUrl(referrer, true);
            } else {
                return false;
            }
            return targetOrigin;
        },

        _cleanUrl: function (url, noproto) {
            var proto = '';
            if (url.slice(0,7) == 'http://') {
                if (noproto === true) proto = 'http://';
                url = url.slice(7);
            }
            if (url.slice(0,8) == 'https://') {
                if (noproto === true) proto = 'https://';
                url = url.slice(8);
            }
            $.each(['#', '?', '/'], function (c) { if(url.indexOf(c) > -1) { url = url.split(c)[0]; } });
            if (noproto !== true && url.slice(0,4) == 'www.') url = url.slice(4);
            return proto+url;
        },

        _cleanObject: function (obj) {
            var newObj = $.isArray(obj) ? [] : {},
                that = this;
            $.each(obj, function (k, v) {
                if (!obj.hasOwnProperty(k)) return;
                if (['boolean', 'number', 'string'].indexOf(typeof v) > -1) {
                    newObj[k] = v;
                } else if ($.isArray(obj) || $.isPlainObject(obj)) {
                    newObj[k] = that._cleanObject(v);
                }
            });
            return newObj;
        },

        ready: function () {

        }
    });


}(jQuery, smile));
