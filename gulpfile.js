//-------------------------------------------------------------------------------------------------
//var SERVER_URL = 'http://192.168.0.3:8000/';
var SERVER_URL = '/';
var VERSIONS = {script:'v174_pre05', res:'v50', icon:'v41', template:'v35'};

//-------------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------
// Imports
var gulp = require('gulp');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');

var sh = require('shelljs');
var delFiles = require('del');
var angularTemplCache = require('gulp-angular-templatecache');
var minifyHtml = require('gulp-minify-html');
var uglify = require('gulp-uglify');
var streamqueue = require('streamqueue');
var print = require('gulp-print');
var order = require('gulp-order');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');

//-------------------------------------------------------------------------------------------------
// Common variables and functions
var inPaths = {};
inPaths.code = './www/_code/';
    inPaths.html = inPaths.code + '**/*.html' ;
    inPaths.js = inPaths.code + '**/*.js';
    inPaths.css = inPaths.code + '**/*.css';
    inPaths.scss = inPaths.code + '**/*.scss';
inPaths.oldCode = './www/_code_old/';
    inPaths.oldJs = inPaths.oldCode + '*.js'; // We do not want the test folder (so not **/*.js)
    inPaths.oldCss = inPaths.oldCode + '**/*.css';
inPaths.htmlTemplate = './www/_htmlTemplate/';

var outPaths = {};
outPaths.base = '../nittio/applications/nittiolearn/';
outPaths.staticBase = outPaths.base + 'static/';
outPaths.script = outPaths.staticBase + '_script_bundles/';
outPaths.scriptScormTesting = outPaths.staticBase + 'others/local-scorm-test-driver/nlcontent'; // For local scorm testing
outPaths.scriptUrl = 'static/_script_bundles/';
outPaths.view = outPaths.base + 'views/default';
outPaths.modules = outPaths.base + 'modules';
outPaths.cleanup = [
    outPaths.staticBase + 'nittio_res*', 
    outPaths.staticBase + 'nittio_icon*', 
    outPaths.staticBase + 'nittio_template*', 
    outPaths.staticBase + '_script_bundles/*',
    outPaths.view + '/index.*',
    outPaths.modules + '/mversion.py',

    // For older cleanups: generated files in nittio repository
    outPaths.staticBase + '_external/ionic*', // For older cleanups
    outPaths.staticBase + '_external/ydn*',
    outPaths.staticBase + '_external/ionicfonts',
    outPaths.staticBase + '_external/lib',
    outPaths.staticBase + 'nittio_script*',

    // For older cleanups: generated files in nittioapp repository
    './www/static/_script_bundles/',
    './www/static/_external_bundles/',
    './www/static/nittio_script_*',
    './www/static/nittio_script_*',
    './www/static/_external'
    ];

function swallowError(error) {
    console.log(error.toString());
    this.emit('end');
}

//-------------------------------------------------------------------------------------------------
// Externally available build tasks
//-------------------------------------------------------------------------------------------------
gulp.task('default', function(done) {
    runSequence('rebuild', 'watch', done);
});

gulp.task('rebuild', function(done) {
    runSequence('clean', 
                ['build', 'nl_copy_res', 'nl_copy_icon', 'nl_copy_template'],
                done);
});

gulp.task('clean', function(done) {
    delFiles(outPaths.cleanup, {force: true},  function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
        done();
    });
});

gulp.task('build', ['nl_html', 'nl_css', 'nl_js', 'nl_js_old', 'nl_js_old_scorm', 
    'nl_css_old1', 'nl_css_old2', 'nl_generate_index', 'nl_generate_index_min', 
    'nl_generate_mversion']);

gulp.task('watch', function() {
    gulp.watch(inPaths.html, ['nl_html']);
    gulp.watch(inPaths.css, ['nl_css']);
    gulp.watch(inPaths.scss, ['nl_css']);
    gulp.watch(inPaths.js, ['nl_js']);
    gulp.watch(inPaths.oldJs, ['nl_js_old', 'nl_js_old_scorm']);
    gulp.watch(inPaths.oldCss, ['nl_css_old1', 'nl_css_old2']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nl_generate_index', 'nl_generate_index_min', 'nl_generate_mversion']);
});

//-------------------------------------------------------------------------------------------------
// Basic tasks of building
//-------------------------------------------------------------------------------------------------
gulp.task('nl_html', function(done) {
    gulp.src(inPaths.html)
    .pipe(order())
    .pipe(angularTemplCache({filename: 'nl.html_fragments.js', module:'nl.html_fragments', standalone:true}))
    .pipe(gulp.dest(outPaths.script))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.script))
    .pipe(gulp.dest('./www/_test_dependencies'))
    .on('end', done);
});

gulp.task('nl_css', function(done) {
    streamqueue({ objectMode: true }, 
                gulp.src(inPaths.scss).pipe(sass()).on('error', swallowError), 
                gulp.src(inPaths.css))
    .pipe(concat('nl.bundle.css'))
    .pipe(gulp.dest(outPaths.script))
    .pipe(minifyCss({keepSpecialComments : 0})).on('error', swallowError)
    .pipe(rename({extname : '.min.css'}))
    .pipe(gulp.dest(outPaths.script))
    .on('end', done);
});

gulp.task('nl_js', function(done) {
    gulp.src(inPaths.js)
    .pipe(order())
    .pipe(concat('nl.bundle.js'))
    .pipe(gulp.dest(outPaths.script))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.script))
    .on('end', done);
});

gulp.task('nl_js_old', function(done) {
    gulp.src(inPaths.oldJs)
    .pipe(concat('nittioold.bundle.js'))
    .pipe(gulp.dest(outPaths.script))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.script))
    .on('end', done);
});

gulp.task('nl_js_old_scorm', ['nl_js_old'], function(done) {
    gulp.src(outPaths.script + '/nittioold.bundle.js')
    .pipe(rename('00.js'))
    .pipe(gulp.dest(outPaths.scriptScormTesting))
    .on('end', done);
});

gulp.task('nl_css_old1', function(done) {
   _copy_css(done, inPaths.oldCode + 'nittioold.css', outPaths.script);
});

gulp.task('nl_css_old2', function(done) {
   _copy_css(done, inPaths.oldCode + 'nittiooldprint.css', outPaths.script);
});

function _copy_css(done, src, dest) {
    gulp.src(src)
    .pipe(gulp.dest(dest))
    .pipe(minifyCss({keepSpecialComments : 0})).on('error', swallowError)
    .pipe(rename({extname : '.min.css'}))
    .pipe(gulp.dest(dest))
    .on('end', done);
}

gulp.task('nl_generate_index', function(done) {
    _generateIndex(done, false);
});
    
gulp.task('nl_generate_index_min', function(done) {
    _generateIndex(done, true);
});

function _generateIndex(done, bMinified) {
    var includeCordova = false;
    var prefix = SERVER_URL + outPaths.scriptUrl;

    var serverType = includeCordova ? 'local' : 'nittio';
    var jsFiles = null;
    var cssFiles = null;
    var destFileName = null;
    if (bMinified) {
        jsFiles = ['nl.html_fragments.min.js', 'nl.bundle.min.js'];
        cssFiles = ['nl.bundle.min.css'];
        destFileName = 'index.min.html';
    } else {
        jsFiles = ['nl.html_fragments.js', 'nl.bundle.js'];
        cssFiles = ['nl.bundle.css'];
        destFileName = 'index.html';
    }
    
    var searchParam = '?version=' + VERSIONS.script;

    var jsList = [];
    for (var i=0; i<jsFiles.length; i++) jsList.push(prefix + jsFiles[i] + searchParam);
    if (includeCordova) jsList.push('cordova.js');

    var cssList = [];
    for (var i=0; i<cssFiles.length; i++) cssList.push(prefix + cssFiles[i] + searchParam);
    
    gulp.src(inPaths.htmlTemplate + 'index_templ.html')
    .pipe(htmlreplace({nl_server_info: {
                           src: [[serverType, SERVER_URL, VERSIONS.script, VERSIONS.res, VERSIONS.icon, VERSIONS.template]], 
                           tpl: "<script>var NL_SERVER_INFO = {serverType: '%s', url: '%s', versions: {script:'%s', res:'%s', icon:'%s', template:'%s'}};</script>"},
                       css: {
                           src: cssList,
                           tpl: '<link rel="stylesheet" href="%s">'},
                       js: {
                           src: jsList,
                           tpl: '<script src="%s"></script>'}
                       }))
    .pipe(rename(destFileName))
    .pipe(gulp.dest(outPaths.view))
    .on('end', function() {
        gulp.src(inPaths.htmlTemplate + 'index_templ.js')
        .pipe(htmlreplace({nl_server_info: {
                               src: [[serverType, SERVER_URL, VERSIONS.script, VERSIONS.res, VERSIONS.icon, VERSIONS.template]], 
                               tpl: "var NL_SERVER_INFO = {serverType: '%s', url: '%s', versions: {script:'%s', res:'%s', icon:'%s', template:'%s'}};"},
                           }))
        .pipe(rename('index_html.js'))
        .pipe(gulp.dest('./www/_test_dependencies'))
        .on('end', done);
    });
}

gulp.task('nl_generate_mversion', function(done) {
    gulp.src(inPaths.htmlTemplate + 'mversion_template.py')
        .pipe(htmlreplace({nl_python_version: {
            src: [[VERSIONS.script, VERSIONS.res, VERSIONS.icon, VERSIONS.template]], 
            tpl: "versions= {'script': '%s', 'res': '%s', 'icon': '%s', 'template':'%s'}"},
        }))
        .pipe(rename('mversion.py'))
        .pipe(gulp.dest(outPaths.modules))
        .on('end', done);
});

//-------------------------------------------------------------------------------------------------
// Resource Copies required during rebuild
//-------------------------------------------------------------------------------------------------
function resourcePath(resType) {
    return 'static/nittio_' + resType + '_' + VERSIONS[resType] + '/';
}

function inResourcePath(resType) {
    return './www/' + resourcePath(resType) + '**';
}

function nittioResourcePath(resType) {
    return outPaths.base + resourcePath(resType);
}

function nittioCopyResouce(done, resType) {
    gulp.src(inResourcePath(resType))
    .pipe(gulp.dest(nittioResourcePath(resType)))
    .on('end', done);
}

gulp.task('nl_copy_res', function(done) {
    nittioCopyResouce(done, 'res');
});

gulp.task('nl_copy_icon', function(done) {
    nittioCopyResouce(done, 'icon');
});

gulp.task('nl_copy_template', function(done) {
    nittioCopyResouce(done, 'template');
});
