/*global module:false*/
module.exports = function(grunt) {
    "use strict";

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

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
                    'src/addons/displays.js'
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
            addons: {
                files: [{
                    expand: true,
                    cwd: 'src/addons',
                    src: '**/*',
                    dest: 'dist/addons'
                }]
            },
            css: {
                src: [
                    'src/player.css',
                    'src/addons/controls.css',
                ],
                dest: 'dist/smileplayer.css'
            }
        },
        uglify: {
            player: {
                files: {
                    'dist/smileplayer-base.min.js': ['dist/smileplayer-base.js'],
                    'dist/smileplayer.min.js': ['dist/smileplayer.js'],
                    'dist/smileplayer-me.min.js': ['dist/smileplayer-me.js'],
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
        }
    });

    grunt.registerTask('build', ['concat:base', 'concat:player', 'concat:css', 'concat:addons', 'concat:mediaelement', 'uglify:player', 'uglify:addons']);
    grunt.registerTask('default', ['build']);

};
