/*global module:false*/
module.exports = function(grunt) {
    "use strict";

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    var pkg = grunt.file.readJSON(__filename.split('/').slice(0, -1).concat(['package.json']).join('/'));

    // Project configuration.
    grunt.initConfig({
        pkg: pkg,
        concat: {
            base: {
                src: [
                    'src/EventDispatcher.js',
                    'src/TrackFormatParser.js',
                    'src/trackshim.js',
                    'src/util.js',
                    'src/player.js'
                ],
                dest: 'dist/smileplayer-base.js'
            },
            player: {
                src: [
                    'dist/smileplayer-base.js',
                    'src/addons/core.js',
                    'src/addons/controls.js',
                    'src/addons/displays.js',
                    'src/embed/child.js'
                ],
                dest: 'dist/smileplayer.js'
            },
            mediaelement: {
                src: [
                    'bower_components/mediaelement/build/mediaelement.js',
                    'dist/smileplayer.js'
                ],
                dest: 'dist/smileplayer-me.js'
            },
            'mediaelement-full': {
                src: [
                    'dist/smileplayer-me.js',
                    'src/addons/areas.js'
                ],
                dest: 'dist/smileplayer-full.js'
            },
            addons: {
                files: [{
                    expand: true,
                    cwd: 'src/addons',
                    src: '**/*',
                    dest: 'dist/addons'
                }]
            },
            postmessage: {
                src: [
                    'src/EventDispatcher.js',
                    'src/util.js',
                    'src/embed/parent.js'
                ],
                dest: 'dist/smileplayer-postmessage.js'
            },
            css: {
                src: [
                    'src/player.css',
                    'src/addons/controls.css',
                ],
                dest: 'dist/smileplayer.css'
            },
            'css-full': {
                src: [
                    'dist/smileplayer.css',
                    'dist/addons/areas.css'
                ],
                dest: 'dist/smileplayer-full.css'
            }
        },
        uglify: {
            player: {
                files: {
                    'dist/smileplayer-base.min.js': ['dist/smileplayer-base.js'],
                    'dist/smileplayer.min.js': ['dist/smileplayer.js'],
                    'dist/smileplayer-me.min.js': ['dist/smileplayer-me.js'],
                    'dist/smileplayer-full.min.js': ['dist/smileplayer-full.js'],
                    'dist/smileplayer-postmessage.min.js': ['dist/smileplayer-postmessage.js'],
                }
            },
            addons: {
                files: {
                    'dist/addons/areas.min.js': ['dist/addons/areas.js'],
                    'dist/addons/controls.min.js': ['dist/addons/controls.js'],
                    'dist/addons/core.min.js': ['dist/addons/core.js'],
                    'dist/addons/displays.min.js': ['dist/addons/displays.js'],
                }
            }
        },
        watch: {
            scripts: {
                files: ['src/**/*.js', 'src/**/*.css'],
                tasks: ['concat', 'uglify'],
                options: {
                    spawn: false
                }
            }
        }
    });

    grunt.registerTask('build', ['concat:base', 'concat:player', 'concat:css', 'concat:addons', 'concat:mediaelement', 'concat:mediaelement-full', 'concat:css-full', 'concat:postmessage',
        'uglify:player', 'uglify:addons']);
    grunt.registerTask('default', ['build']);

};
