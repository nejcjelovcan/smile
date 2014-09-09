var smile = {};
(function ($, smile) {

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
                else if ((item.value||'').substr(0,1) == '{') obj[item.key] = smile.util.parseObjectLiteral(item.value);
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
            Parse integer time_ms from string

            Expected format: [[HH":"]MM":"]SS["."000]
            If non string is passed, it is returned as integer/float

            @param  {String}    str
            @type   Integer
        */
        parseTime: function (str) {
            var spl = str.split(':'),
                secs = 0.0;
            for(var i = spl.length - 1; i >= 0; i -= 1) {
                if (i === spl.length - 1) {
                    secs += parseFloat(spl[i], 10);
                } else {
                    secs += Math.pow(60, spl.length - 1 - i)*parseInt(spl[i], 10);
                }
            }
            if (secs !== secs) return 0;
            return ~~(secs * 1000);
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
        },

        /**
            Convert string to XML Document
            @param  {String}    str
            @type   XMLDocument
        */
        stringToDoc: function (str) {
            var doc, parser;
            if (window.ActiveXObject){
                doc = new ActiveXObject('Microsoft.XMLDOM');
                doc.async='false';
                doc.loadXML(str);
            } else {
                parser = new DOMParser();
                doc = parser.parseFromString(str, 'text/xml');
            }
            return doc;
        }

        
    };

    $.fn.dataObject = function (attrName) {
        return smile.util.parseObjectLiteral($(this).data(attrName));
    };


    $.throttle = jq_throttle = function( delay, no_trailing, callback, debounce_mode ) {
        var timeout_id,
            last_exec = 0;
    
        // `no_trailing` defaults to falsy.
        if ( typeof no_trailing !== 'boolean' ) {
            debounce_mode = callback;
            callback = no_trailing;
            no_trailing = undefined;
        }
    
        function wrapper() {
            var that = this,
                elapsed = +new Date() - last_exec,
                args = arguments;
          
            // Execute `callback` and update the `last_exec` timestamp.
            function exec() {
                last_exec = +new Date();
                callback.apply( that, args );
            };
          
            // If `debounce_mode` is true (at_begin) this is used to clear the flag
            // to allow future `callback` executions.
            function clear() {
                timeout_id = undefined;
            };
          
            if ( debounce_mode && !timeout_id ) {
                // Since `wrapper` is being called for the first time and
                // `debounce_mode` is true (at_begin), execute `callback`.
                exec();
            }
          
            // Clear any existing timeout.
            timeout_id && clearTimeout( timeout_id );
          
            if ( debounce_mode === undefined && elapsed > delay ) {
                // In throttle mode, if `delay` time has been exceeded, execute
                // `callback`.
                exec();
            } else if ( no_trailing !== true ) {
                timeout_id = setTimeout( debounce_mode ? clear : exec, debounce_mode === undefined ? delay - elapsed : delay );
            }
        };
            
        if ( $.guid ) {
            wrapper.guid = callback.guid = callback.guid || $.guid++;
        }
        
        return wrapper;
    };
  
  
    $.debounce = function( delay, at_begin, callback ) {
        return callback === undefined
            ? jq_throttle( delay, at_begin, false )
            : jq_throttle( delay, callback, at_begin !== false );
    };

    $.delay = function ( delay, callback ) {
        return function () {
            setTimeout(callback, delay);
        };
    };


}(jQuery, smile));