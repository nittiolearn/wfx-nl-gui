//-------------------------------------------------------------------------------------------------
//var SERVER_URL = 'http://192.168.0.3:8000/';
var SERVER_URL = '/';
var VERSIONS = {script:'v74', res:'v50', icon:'v41', template:'v35', externVersion: 'v01'};
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
var karma = require('gulp-karma');
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
inPaths.extern = './www/_extern/';
inPaths.htmlTemplate = './www/_htmlTemplate/';
inPaths.karma = ['www/js/ionic.bundle.min.js', 'www/js/ydn.db-isw-core-qry.js', 'www/js/nl.html_fragments.min.js',
    'node_modules/angular-mocks/angular-mocks.js', 'www/_code/**/*.js', 'www/_test/**/*.js'];

var outPaths = {};
outPaths.urlScript = 'static/_script_bundles/';
outPaths.urlExtern = 'static/_external_bundles/';
outPaths.folderScript = './www/' + outPaths.urlScript;
outPaths.folderExtern = './www/' + outPaths.urlExtern;
outPaths.urlManifest = 'static/';
outPaths.folderManifest = './www/' + outPaths.urlManifest;
outPaths.cleanup = [
    outPaths.folderScript,
    outPaths.folderExtern,
    './www/static/nittio_script_*',  // For older cleanups
    './www/static/nittio_script_*',  // For older cleanups
    './www/static/_external'  // For older cleanups
    ];

function swallowError(error) {
    console.log(error.toString());
    this.emit('end');
}

//-------------------------------------------------------------------------------------------------
// Externally available build tasks
//-------------------------------------------------------------------------------------------------
gulp.task('default', ['build', 'nl_watch']);
gulp.task('build', ['nl_html', 'nl_css', 'nl_js', 'nl_generate_index', 'nl_js_old', 'nl_css_old']);
gulp.task('clean', ['nl_clean']);
gulp.task('rebuild', ['nl_copy_ext', 'build']);

//-------------------------------------------------------------------------------------------------
// Rebuilding complete project including external libraries
//-------------------------------------------------------------------------------------------------
gulp.task('nl_copy_ext', ['nl_copy_extjs', 'nl_copy_extfonts']);

gulp.task('nl_copy_extjs', function(done) {
    var extFiles = [inPaths.extern + 'ionic/js/ionic.bundle.js',
                    inPaths.extern + 'ionic/js/ionic.bundle.min.js',
                    inPaths.extern + 'ydn-db/ydn.db-isw-core-qry.js',
                    inPaths.extern + 'ydn-db/ydn.db-isw-core-qry.min.js'];
    return gulp.src(extFiles).pipe(gulp.dest(outPaths.folderExtern));
});

gulp.task('nl_copy_extfonts', function(done) {
    gulp.src(inPaths.extern + 'ionic/fonts/*')
    .pipe(gulp.dest(outPaths.folderExtern + 'ionicfonts'))
    .on('end', done);
});

//-------------------------------------------------------------------------------------------------
// Basic tasks of building
//-------------------------------------------------------------------------------------------------
gulp.task('nl_html', function(done) {
    gulp.src(inPaths.html)
    .pipe(order())
    .pipe(angularTemplCache({filename: 'nl.html_fragments.js', module:'nl.html_fragments', standalone:true}))
    .pipe(gulp.dest(outPaths.folderScript))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.folderScript))
    .pipe(gulp.dest('./www/_test_dependencies'))
    .on('end', done);
});

gulp.task('nl_css', function(done) {
    streamqueue({ objectMode: true }, 
                gulp.src(inPaths.scss).pipe(sass()).on('error', swallowError), 
                gulp.src(inPaths.css))
    .pipe(concat('nl.bundle.css'))
    .pipe(gulp.dest(outPaths.folderScript))
    .pipe(minifyCss({keepSpecialComments : 0})).on('error', swallowError)
    .pipe(rename({extname : '.min.css'}))
    .pipe(gulp.dest(outPaths.folderScript))
    .on('end', done);
});

gulp.task('nl_js', function(done) {
    gulp.src(inPaths.js)
    .pipe(order())
    .pipe(concat('nl.bundle.js'))
    .pipe(gulp.dest(outPaths.folderScript))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.folderScript))
    .on('end', done);
});

gulp.task('nl_generate_index', function(done) {
    var fixes = {
        jsExtPrefix: SERVER_URL + outPaths.urlExtern,
        jsExtSuffix: '.js',
        jsIntPrefix: SERVER_URL + outPaths.urlScript,
        jsIntSuffix: '.js',
        cssPrefix: SERVER_URL + outPaths.urlScript,
        cssSuffix: '.css'
    };
    generateIndexHtml(done, './www', fixes, true);
});

function generateIndexHtml(done, dest, fixes, includeCordova) {
    if (includeCordova === undefined) includeCordova = false;
    
    var serverType = includeCordova ? 'local' : 'nittio';
    var extFiles = ['ydn.db-isw-core-qry', 'ionic.bundle'];
    var intFiles = ['nl.html_fragments', 'nl.bundle'];
    var cssFiles = ['nl.bundle'];
    
    var searchParam = '?version=' + VERSIONS.script;
    var externSearchParam = '?version=' + VERSIONS.externVersion;

    var jsList = [];
    for (var i=0; i<extFiles.length; i++) jsList.push(fixes.jsExtPrefix + extFiles[i] + fixes.jsExtSuffix + externSearchParam);
    for (var i=0; i<intFiles.length; i++) jsList.push(fixes.jsIntPrefix + intFiles[i] + fixes.jsIntSuffix + searchParam);
    if (includeCordova) jsList.push('cordova.js');

    var cssList = [];
    for (var i=0; i<cssFiles.length; i++) cssList.push(fixes.cssPrefix + cssFiles[i] + fixes.cssSuffix + searchParam);
    
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
    .pipe(rename('index.html'))
    .pipe(gulp.dest(dest))
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

gulp.task('nl_update_manifest', function(done) {
    updateManifest(done, outPaths.folderManifest);
});

function updateManifest(done, dest) {
    var timestamp = (new Date()).getTime();
    var baseUrl = '/';
    gulp.src(inPaths.htmlTemplate + 'manifest_templ.appcache')
    .pipe(htmlreplace({manifest_data: {
                           src: [[baseUrl, VERSIONS.script, timestamp]], 
                           tpl: '%s # version: %s (%s)'}
                       }))
    .pipe(rename('manifest.appcache'))
    .pipe(gulp.dest(dest))
    .on('end', done);
}

gulp.task('nl_js_old', function(done) {
    gulp.src(inPaths.oldJs)
    .pipe(concat('nittioold.bundle.js'))
    .pipe(gulp.dest(outPaths.folderScript))
    .pipe(uglify()).on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPaths.folderScript))
    .on('end', done);
});

gulp.task('nl_css_old', ['nl_css_old_1', 'nl_css_old_2']);

gulp.task('nl_css_old_1', function(done) {
   _copy_css(done, inPaths.oldCode + 'nittioold.css', outPaths.folderScript);
});

gulp.task('nl_css_old_2', function(done) {
   _copy_css(done, inPaths.oldCode + 'nittiooldprint.css', outPaths.folderScript);
});

function _copy_css(done, src, dest) {
    gulp.src(src)
    .pipe(gulp.dest(dest))
    .pipe(minifyCss({keepSpecialComments : 0})).on('error', swallowError)
    .pipe(rename({extname : '.min.css'}))
    .pipe(gulp.dest(dest))
    .on('end', done);
}

gulp.task('nl_watch', function() {
    gulp.watch(inPaths.html, ['nl_html']);
    gulp.watch(inPaths.css, ['nl_css']);
    gulp.watch(inPaths.scss, ['nl_css']);
    gulp.watch(inPaths.js, ['nl_js']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nl_generate_index']);
    gulp.watch(inPaths.oldJs, ['nl_js_old']);
    gulp.watch(inPaths.oldCss, ['nl_css_old']);
});

gulp.task('nl_clean', function(done) {
    delFiles(outPaths.cleanup, function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
    });
});

//-------------------------------------------------------------------------------------------------
// Testing with Karma
//-------------------------------------------------------------------------------------------------
gulp.task('karma', function(done) {
    gulp.src(inPaths.karma)
    .pipe(karma({
        configFile: 'karma.conf.js',
        action: 'run',
        browsers: ['Chrome']
    }))
    .on('end', done);
});

gulp.task('karma_all', function(done) {
    gulp.src(inPaths.karma)
    .pipe(karma({
        configFile: 'karma.conf.js',
        action: 'run'
    }))
    .on('end', done);
});

//-------------------------------------------------------------------------------------------------
// Nittio deployments
//-------------------------------------------------------------------------------------------------
var nittioPaths = {};
nittioPaths.base = '../nittio/applications/nittiolearn/';
nittioPaths.staticBase = nittioPaths.base + 'static/';
nittioPaths.script = nittioPaths.base + outPaths.urlScript;
nittioPaths.extern = nittioPaths.base + outPaths.urlExtern;
nittioPaths.manifest = nittioPaths.base + outPaths.urlManifest;
nittioPaths.view = nittioPaths.base + 'views/default';
nittioPaths.modules = nittioPaths.base + 'modules';
nittioPaths.cleanup = [
    nittioPaths.staticBase + 'nittio_res*', 
    nittioPaths.staticBase + 'nittio_icon*', 
    nittioPaths.staticBase + 'nittio_template*', 
    nittioPaths.staticBase + '_script_bundles/*',
    nittioPaths.staticBase + '_external_bundles/*',
    nittioPaths.view + '/index.html',
    nittioPaths.modules + '/mversion.py',
    nittioPaths.staticBase + '_external/ionic*', // For older cleanups
    nittioPaths.staticBase + '_external/ydn*', // For older cleanups
    nittioPaths.staticBase + '_external/ionicfonts', // For older cleanups
    nittioPaths.staticBase + '_external/lib', // For older cleanups
    nittioPaths.staticBase + 'nittio_script*' // For older cleanups
    ];


function resourcePath(resType) {
    return 'static/nittio_' + resType + '_' + VERSIONS[resType] + '/';
}

function inResourcePath(resType) {
    return './www/' + resourcePath(resType) + '**';
}

function nittioResourcePath(resType) {
    return nittioPaths.base + resourcePath(resType);
}

function nittioCopyResouce(done, resType) {
    gulp.src(inResourcePath(resType))
    .pipe(gulp.dest(nittioResourcePath(resType)))
    .on('end', done);
}

gulp.task('nittio_clean', function(done) {
    delFiles(nittioPaths.cleanup, {force: true},  function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
    });
});

gulp.task('nittio_build', function(done) {
    runSequence('build',
                ['nittio_copy_res', 'nittio_copy_icon', 'nittio_copy_template', 
                'nittio_copy_script', 'nittio_generate_index', 'nittio_generate_mversion'],
                done);
});

gulp.task('nittio_watch', ['nittio_build', 'nl_watch'], function() {
    //------------------------------------------------------------------------------------------
    // Adding stuff does not work - so no point watch below folders
    //gulp.watch(inResourcePath('res'), ['nittio_copy_res']);
    //gulp.watch(inResourcePath('icon'), ['nittio_copy_icon']);
    //gulp.watch(inResourcePath('template'), ['nittio_copy_template']);
    //------------------------------------------------------------------------------------------
    gulp.watch(outPaths.folderScript + '**', ['nittio_copy_script_int']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nittio_generate_index', 'nittio_generate_mversion']);
});

gulp.task('nittio_copy_res', function(done) {
    nittioCopyResouce(done, 'res');
});

gulp.task('nittio_copy_icon', function(done) {
    nittioCopyResouce(done, 'icon');
});

gulp.task('nittio_copy_template', function(done) {
    nittioCopyResouce(done, 'template');
});

gulp.task('nittio_copy_script', ['nittio_copy_script_ext', 'nittio_copy_script_int']);
    
gulp.task('nittio_copy_script_ext', function(done) {
    gulp.src(outPaths.folderExtern + '**')
    .pipe(gulp.dest(nittioPaths.extern))
    .on('end', done);
});

gulp.task('nittio_copy_script_int', function(done) {
    gulp.src(outPaths.folderScript + '**')
    .pipe(gulp.dest(nittioPaths.script))
    .on('end', done);
});

gulp.task('nittio_generate_index', function(done) {
    var nittioUrlSuffix = "')}}";
    var fixes = {
        jsExtPrefix: SERVER_URL + outPaths.urlExtern,
        jsExtSuffix: '.js',
        jsIntPrefix: SERVER_URL + outPaths.urlScript,
        jsIntSuffix: '.js',
        cssPrefix: SERVER_URL + outPaths.urlScript,
        cssSuffix: '.css'
    };
    generateIndexHtml(done, nittioPaths.view, fixes, false);
});

gulp.task('nittio_generate_mversion', function(done) {
    gulp.src(inPaths.htmlTemplate + 'mversion_template.py')
        .pipe(htmlreplace({nl_python_version: {
            src: [[VERSIONS.script, VERSIONS.res, VERSIONS.icon, VERSIONS.template]], 
            tpl: "versions= {'script': '%s', 'res': '%s', 'icon': '%s', 'template':'%s'}"},
        }))
        .pipe(rename('mversion.py'))
        .pipe(gulp.dest(nittioPaths.modules))
        .on('end', done);
});

gulp.task('nittio_update_manifest', function(done) {
    updateManifest(done, nittioPaths.manifest);
});
