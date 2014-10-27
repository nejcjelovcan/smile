/**
    This code is copied from mep-feature-track.js MIT
    bower mediaelement#2.14.2       cached git://github.com/johndyer/mediaelement.git#2.14.2
    used by trackshim.js
*/
(function ($, mejs) {
    /*
    Parses WebVVT format which should be formatted as
    ================================
    WEBVTT

    1
    00:00:01,1 --> 00:00:05,000
    A line of text

    2
    00:01:15,1 --> 00:02:05,000
    A second line of text

    ===============================

    Adapted from: http://www.delphiki.com/html5/playr
    */
    mejs.TrackFormatParser = {
        webvvt: {
            // match start "chapter-" (or anythingelse)
            pattern_identifier: /^([a-zA-Z]+)?[0-9]+$/,
            pattern_timecode: /^([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{1,3})?) --\> ([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{3})?)(.*)$/,

            parse: function(trackText) {
                var
                    i = 0,
                    lines = mejs.TrackFormatParser.split2(trackText, /\r?\n/),
                    entries = {text:[], times:[], ids:[]},
                    idcode,
                    timecode,
                    text;
                for(; i<lines.length; i++) {
                    // check for the line number
                    idcode = this.pattern_identifier.exec(lines[i]);
                    timecode = this.pattern_timecode.exec(lines[i]);
                    if (idcode || timecode){
                        // skip to the next line where the start --> end time code should be
                        if (idcode) {
                            i++;
                            timecode = this.pattern_timecode.exec(lines[i]);
                        }

                        if (timecode && i<lines.length){
                            i++;
                            // grab all the (possibly multi-line) text that follows
                            text = lines[i];
                            i++;
                            while(lines[i] !== '' && i<lines.length){
                                text = text + '\n' + lines[i];
                                i++;
                            }
                            text = $.trim(text);
                            // cheap trick - if not json, replace urls with link html
                            if (text.substr(0,1) != '{') text = text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                            // Text is in a different array so I can use .join
                            entries.text.push(text);
                            entries.ids.push(idcode ? idcode[0] : '');
                            entries.times.push(
                            {
                                start: (mejs.Utility.convertSMPTEtoSeconds(timecode[1]) == 0) ? 0.200 : mejs.Utility.convertSMPTEtoSeconds(timecode[1]),
                                stop: mejs.Utility.convertSMPTEtoSeconds(timecode[3]),
                                settings: timecode[5]
                            });
                        }
                    }
                }
                return entries;
            }
        },
        // Thanks to Justin Capella: https://github.com/johndyer/mediaelement/pull/420
        dfxp: {
            parse: function(trackText) {
                trackText = $(trackText).filter("tt");
                var
                    i = 0,
                    container = trackText.children("div").eq(0),
                    lines = container.find("p"),
                    styleNode = trackText.find("#" + container.attr("style")),
                    styles,
                    begin,
                    end,
                    text,
                    entries = {text:[], times:[]};


                if (styleNode.length) {
                    var attributes = styleNode.removeAttr("id").get(0).attributes;
                    if (attributes.length) {
                        styles = {};
                        for (i = 0; i < attributes.length; i++) {
                            styles[attributes[i].name.split(":")[1]] = attributes[i].value;
                        }
                    }
                }

                for(i = 0; i<lines.length; i++) {
                    var style;
                    var _temp_times = {
                        start: null,
                        stop: null,
                        style: null
                    };
                    if (lines.eq(i).attr("begin")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("begin"));
                    if (!_temp_times.start && lines.eq(i-1).attr("end")) _temp_times.start = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i-1).attr("end"));
                    if (lines.eq(i).attr("end")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i).attr("end"));
                    if (!_temp_times.stop && lines.eq(i+1).attr("begin")) _temp_times.stop = mejs.Utility.convertSMPTEtoSeconds(lines.eq(i+1).attr("begin"));
                    if (styles) {
                        style = "";
                        for (var _style in styles) {
                            style += _style + ":" + styles[_style] + ";";
                        }
                    }
                    if (style) _temp_times.style = style;
                    if (_temp_times.start == 0) _temp_times.start = 0.200;
                    entries.times.push(_temp_times);
                    text = $.trim(lines.eq(i).html()).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
                    entries.text.push(text);
                    if (entries.times.start == 0) entries.times.start = 2;
                }
                return entries;
            }
        },
        split2: function (text, regex) {
            // normal version for compliant browsers
            // see below for IE fix
            return text.split(regex);
        }
    };

    // test for browsers with bad String.split method.
    if ('x\n\ny'.split(/\n/gi).length != 3) {
        // add super slow IE8 and below version
        mejs.TrackFormatParser.split2 = function(text, regex) {
            var
                parts = [],
                chunk = '',
                i;

            for (i=0; i<text.length; i++) {
                chunk += text.substring(i,i+1);
                if (regex.test(chunk)) {
                    parts.push(chunk.replace(regex, ''));
                    chunk = '';
                }
            }
            parts.push(chunk);
            return parts;
        }
    }
}(jQuery, mejs));