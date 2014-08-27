
var mediaElement, newMediaElement = function () {
    var a = new EventDispatcher;
    $.extend(a, mejs.MediaElementTracksTrait);
    return a;
};

module('mejs.MediaElementTracksTrait');
// for testing assume all is shimmed
window.TextTrack.shim = true;

test('._initTextTracks', function () {
    expect(2);

    mediaElement = newMediaElement();
    mediaElement._initTextTracks();

    equal(mejs.TextTrackList.prototype.isPrototypeOf(mediaElement.textTracks), true);

    // _initTextTracks sets up addtrack listener, test it
    var oldActivate = mejs.TextTrack.prototype._activate;
    mejs.TextTrack.prototype._activate = function (a) {
        equal(a, mediaElement);
    };
    mediaElement.addTextTrack('captions', 'Test', 'sl', {mode: 'showing'});
    mejs.TextTrack.prototype._activate = oldActivate;

    // just for coverage
    mediaElement.textTracks[0].setMode('hidden');
    mediaElement.textTracks[0].setMode('showing');
});

test('._parseTextTracks', function () {    
    expect(5);
    mediaElement = newMediaElement();
    mediaElement.addTextTrack = function (kind, label, lang) {
        if (kind == 'captions'){
            equal(label, 'Slovenian captions');
            equal(lang, 'sl');
        } else if (kind == 'subtitles') {
            equal(label, 'English subtitles');
            equal(lang, 'en');
        }
        mejs.MediaElementTracksTrait.addTextTrack.call(this, kind, label, lang);
    }

    var el = $('<video>')
        .append($('<track kind="captions" srclang="sl" label="Slovenian captions" />'))
        .append($('<track kind="subtitles" srclang="en" label="English subtitles" />'));
    mediaElement._initTextTracks(el[0]);

    equal(mediaElement.textTracks.length, 2);
});

test('.addTextTrack', function () {
    mediaElement = Object.create(mejs.MediaElementTracksTrait);
    mediaElement.textTracks = new mejs.TextTrackList;

    mediaElement.addTextTrack('metadata', 'label', 'en', {})
    equal(mediaElement.textTracks.length, 1);
    equal(mediaElement.textTracks[0].kind, 'metadata');
    equal(mediaElement.textTracks[0].label, 'label');
    equal(mediaElement.textTracks[0].language, 'en');
});

module('mejs.TrackEvent');

test('.constructor', function () {
    var track = new mejs.TextTrack,
        ev = new mejs.TrackEvent('eventtype', {bubbles: true, cancelable: true, track: track});

    equal(ev.bubbles, true);
    equal(ev.cancelable, true);
    equal(ev.track, track);
});

test('.constructor (track property illegal)', function () {
    throws(
        function () { new mejs.TrackEvent('cuechange', {track: {}})},
        /Failed to construct/
    )
});

module('mejs.TextTrackList');

test('.push', function () {
    expect(1);
    var ttl = new mejs.TextTrackList,
        track = new mejs.TextTrack;

    ttl.addEventListener('addtrack', function (ev) {
        equal(ev.track, track);
    });
    ttl.push(track);
});

test('.getTrackById', function () {
    var ttl = new mejs.TextTrackList,
        track = new mejs.TextTrack({id: 'test'});
    ttl.push(track);
    equal(ttl.getTrackById('test'), track);
});

test('.item', function () {
    var ttl = new mejs.TextTrackList,
        track = new mejs.TextTrack;
    ttl.push(track);
    equal(ttl.item(0), track);
});

module('mejs.TextTrack');

test('.constructor', function () {
    expect(7);
    stop();
    var node = $('<track>')[0],
        track = new mejs.TextTrack({
            kind: 'metadata',
            label: 'label',
            language: 'en',
            id: 'test1',
            src: 'metadata.vtt',
            node: node
        });
    track.node.addEventListener('load', function () {
        equal(node._readyState, 2);
        start();
    });

    equal(track.kind, 'metadata');
    equal(track.label, 'label');
    equal(track.language, 'en');
    equal(track.id, 'test1');
    equal(track.src, 'metadata.vtt');
    equal(track.node, node);
});

test('.constructor (src 404)', function () {
    expect(1);
    stop();
    var node = $('<track>')[0],
        track = new mejs.TextTrack({
            kind: 'metadata',
            label: 'label',
            language: 'en',
            id: 'test2',
            src: 'metadata_does_not_exist.vtt',
            node: node
        });
    track.node.addEventListener('error', function () {
        equal(node._readyState, 3);
        start();
    });
});

test('.ready', function () {
    expect(2);
    stop();

    var node = $('<track>')[0],
        track = new mejs.TextTrack({
            kind: 'metadata',
            label: 'label',
            language: 'en',
            id: 'test3',
            src: 'metadata.vtt',
            node: node
        });

    track.ready(function () {
        ok(true);
        track.ready(function () {
            ok(true); 
            start();
        });
    });
});

test('.addCue', function () {
    var track = new mejs.TextTrack,
        cue = new mejs.TextTrackCue(1,2,'test');
    track.addCue(cue);
    equal(track.cues.length, 1);
    equal(track.cues[0], cue);
});

test('.removeCue', function () {
    var track = new mejs.TextTrack,
        cue = new mejs.TextTrackCue(1,2,'test'),
        cue2 = new mejs.TextTrackCue(3,4,'test2');
    track.addCue(cue);
    track.addCue(cue2);
    equal(track.cues.length, 2);
    
    track.removeCue(cue);
    equal(track.cues.length, 1);
    equal(track.cues[0], cue2);

    throws(
        function () { track.removeCue(cue); },
        /The specified cue is not listed in the TextTrack/
    )
});

test('._update', function () {
    expect(1);

    mediaElement = newMediaElement();
    mediaElement._initTextTracks();

    var node = $('<track>')[0],
        track = mediaElement.addTextTrack('metadata', 'Metadata', 'sl', {
            src: 'metadata.vtt',
            node: node
        });
    track.addEventListener('cuechange', function (a,b,c) {
        console.log('CUE CHANGE',track.activeCues.map(function (c) { return c.id; }));
    });
    track.node.addEventListener('load', function () {
        start();
        ok(true);
        
        var evt = document.createEvent('CustomEvent');
        evt.initEvent('timeupdate', false, false);
        evt.mediaElement = mediaElement

        mediaElement.currentTime = 4.0;
        mediaElement.dispatchEvent(evt);
        
        mediaElement.currentTime = 11.0;
        mediaElement.dispatchEvent(evt);

        mediaElement.currentTime = 4.5;
        mediaElement.dispatchEvent(evt);

        track.setMode('disabled');
    });
    stop();
    track.setMode('showing');
});

module('mejs.TextTrackCueList');

test('.getCueById', function () {
    var track = new mejs.TextTrack,
        cue = new mejs.TextTrackCue(1,2,'test',{id: 'cue1'}),
        cue2 = new mejs.TextTrackCue(3,4,'test2',{id: 'cue2'});

    track.addCue(cue);
    track.addCue(cue2);

    equal(track.cues.getCueById('cue2'), cue2);
});

module('mejs.TextTrackCue');

test('.constructor', function () {
    throws(
        function () { new mejs.TextTrackCue; },
        /Failed to construct/
    );
});

