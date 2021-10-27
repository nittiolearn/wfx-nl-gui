//-------------------------------------------------------------------------------------------------
var VERSIONS = { script: 'v2021Q4S1-pre01', extscript: 'v205', res: 'v100', icon: 'v100', template: 'v100' };
//-------------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------
// Imports
var gulp = require('gulp');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var gulpReplace = require('gulp-replace');

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
inPaths.html = inPaths.code + '**/*.html';
inPaths.js = inPaths.code + '**/*.js';
inPaths.css = inPaths.code + '**/*.css';
inPaths.scss = inPaths.code + '**/*.scss';
inPaths.oldCode = './www/_code_old/';
inPaths.oldJs = inPaths.oldCode + '*.js'; // We do not want the test folder (so not **/*.js)
inPaths.oldCss = inPaths.oldCode + '**/*.css';
inPaths.extBundleSrc = './www/_extern/for_bundle';
inPaths.htmlTemplate = './www/_htmlTemplate/';
inPaths.jsonTemplate = './www/_wfxbridge/modulejsons/*.json';
inPaths.wfxHtmlTemplate = './www/_wfxbridge/*.html';

var outPaths = {};
// TODO - change to copy to whatfix lib folder
outPaths.script = '../wfx-nl-server/applications/nittiolearn/static/nittio-client/';
outPaths.cleanup = [
    outPaths.script + '*'
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
    runSequence('clean', ['build', 'nl_copy_wfxhtml', 'nl_copy_wfxjson'],
        done);
});

gulp.task('clean', function(done) {
    delFiles(outPaths.cleanup, { force: true }, function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
        done();
    });
});

gulp.task('build', ['nl_html', 'nl_css', 'nl_js', 'nl_js_old',
    'nl_css_old1', 'nl_css_old2', 'nl_generate_html', 'nl_ext_bundles'
]);

gulp.task('watch', function() {
    gulp.watch(inPaths.html, ['nl_html']);
    gulp.watch(inPaths.css, ['nl_css']);
    gulp.watch(inPaths.scss, ['nl_css']);
    gulp.watch(inPaths.js, ['nl_js']);
    gulp.watch(inPaths.oldJs, ['nl_js_old']);
    gulp.watch(inPaths.oldCss, ['nl_css_old1', 'nl_css_old2']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nl_generate_html']);
});

//-------------------------------------------------------------------------------------------------
// Basic tasks of building
//-------------------------------------------------------------------------------------------------
gulp.task('nl_html', function(done) {
    gulp.src(inPaths.html)
        .pipe(order())
        .pipe(angularTemplCache({ filename: 'nl.html_fragments.js', module: 'nl.html_fragments', standalone: true }))
        .pipe(gulp.dest(outPaths.script))
        .pipe(uglify()).on('error', swallowError)
        .pipe(rename({ extname: '.min.js' }))
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});

gulp.task('nl_css', function(done) {
    streamqueue({ objectMode: true },
            gulp.src(inPaths.scss).pipe(sass()).on('error', swallowError),
            gulp.src(inPaths.css))
        .pipe(concat('nl.bundle.css'))
        .pipe(gulp.dest(outPaths.script))
        .pipe(minifyCss({ keepSpecialComments: 0 })).on('error', swallowError)
        .pipe(rename({ extname: '.min.css' }))
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});

gulp.task('nl_js', function(done) {
    gulp.src(inPaths.js)
        .pipe(order())
        .pipe(concat('nl.bundle.js'))
        .pipe(gulp.dest(outPaths.script))
        .pipe(uglify()).on('error', swallowError)
        .pipe(rename({ extname: '.min.js' }))
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});

gulp.task('nl_js_old', function(done) {
    gulp.src(inPaths.oldJs)
        .pipe(concat('nittioold.bundle.js'))
        .pipe(gulp.dest(outPaths.script))
        .pipe(uglify()).on('error', swallowError)
        .pipe(rename({ extname: '.min.js' }))
        .pipe(gulp.dest(outPaths.script))
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
        .pipe(minifyCss({ keepSpecialComments: 0 })).on('error', swallowError)
        .pipe(rename({ extname: '.min.css' }))
        .pipe(gulp.dest(dest))
        .on('end', done);
}

gulp.task('nl_generate_html', function(done) {
    _generateHtmls(done);
});

function _generateHtmls(done) {
    generateHtml(done, 'nlcourse', true);
    generateHtml(done, 'nlcourse', false);
    generateHtml(done, 'nlmodule', true);
    generateHtml(done, 'nlmodule', false);
    done();
}

function generateHtml(done, indexFileName, bMinified) {
    var destFileName = indexFileName + (bMinified ? '.min.html' : '.html');
    gulp.src(inPaths.htmlTemplate + indexFileName + '.html')
        .pipe(gulpReplace(/\{\{VERSIONS_SCRIPT\}\}/g, makeVersionsScript()))
        .pipe(gulpReplace(/\{\{NL_SCRIPT_PARAMS\}\}/g, getNlScriptParams(bMinified)))
        .pipe(gulpReplace(/\{\{EXT_SCRIPT_PARAMS\}\}/g, getExtScriptParams()))
        .pipe(rename(destFileName))
        .pipe(gulp.dest(outPaths.script));
}

function makeVersionsScript() {
    return `<script>var NL_SERVER_INFO = {versions: {script: '${VERSIONS.script}', extscript: '${VERSIONS.extscript}', res: '${VERSIONS.res}', icon: '${VERSIONS.icon}', template: '${VERSIONS.template}'}};</script>`;
}

function getNlScriptParams(bMinified) {
    var min = bMinified ? '.min' : '';
    return min + `.js?version=${VERSIONS.script}`;
}

function getExtScriptParams() {
    return `.min.js?version=${VERSIONS.extscript}`;
}

gulp.task('nl_ext_bundles', ['nl_ext_js1', 'nl_ext_js2', 'nl_ext_js3', 'nl_ext_js4', 'nl_ext_css1', 'nl_ext_css2', 'nl_ext_fonts']);

gulp.task('nl_ext_js1', function(done) {
    makeExtBundle('js', 1, done);
});

gulp.task('nl_ext_js2', function(done) {
    makeExtBundle('js', 2, done);
});

gulp.task('nl_ext_js3', function(done) {
    makeExtBundle('js', 3, done);
});

gulp.task('nl_ext_js4', function(done) {
    makeExtBundle('js', 4, done);
});

gulp.task('nl_ext_css1', function(done) {
    makeExtBundle('css', 1, done);
});

gulp.task('nl_ext_css2', function(done) {
    makeExtBundle('css', 2, done);
});

function makeExtBundle(extType, bundleNo, done) {
    var inPath = inPaths.extBundleSrc + '/ext' + extType + bundleNo + '-src/*.' + extType;
    gulp.src(inPath)
        .pipe(order())
        .pipe(concat('nlext' + bundleNo + '.bundle.min.' + extType))
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
}


gulp.task('nl_ext_fonts', function(done) {
    gulp.src(inPaths.extBundleSrc + '/extfonts')
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});


//-------------------------------------------------------------------------------------------------
// Resource Copies required during rebuild
//-------------------------------------------------------------------------------------------------
gulp.task('nl_copy_wfxhtml', function(done) {
    gulp.src(inPaths.wfxHtmlTemplate)
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});

gulp.task('nl_copy_wfxjson', function(done) {
    gulp.src(inPaths.jsonTemplate)
        .pipe(gulp.dest(outPaths.script))
        .on('end', done);
});