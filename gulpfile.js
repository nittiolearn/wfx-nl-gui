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

//-------------------------------------------------------------------------------------------------
var SERVER_URL = '/';
var VERSIONS = {script:'v65', res:'v39', icon:'v41', template:'v35'};
//-------------------------------------------------------------------------------------------------

var inPaths = {
    lib: './www/_extern/',
    html : './www/_code/**/*.html',
    css : './www/_code/css/*.css',
    scss : './www/_code/css/*.scss',
    js : './www/_code/**/*.js',
    htmlTemplate: './www/_htmlTemplate/',
    karma : [
      'www/js/ionic.bundle.min.js',
      'www/js/ydn.db-isw-core-qry.js',
      'www/js/nl.html_fragments.min.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'www/_code/**/*.js',
      'www/_test/**/*.js'
    ]
};

var outUrlPath = '/static/nittio_script_' + VERSIONS.script + '/nlappjs/';
var outPath = './www' + outUrlPath;

function swallowError(error) {
    console.log(error.toString());
    this.emit('end');
}

//-------------------------------------------------------------------------------------------------
// Basic tasks of building
//-------------------------------------------------------------------------------------------------
gulp.task('default', ['build', 'nl_watch']);
gulp.task('build', ['nl_html', 'nl_css', 'nl_js', 'nl_generate_index']);
gulp.task('rebuild', ['nl_copy', 'build']);

gulp.task('nl_watch', function() {
    gulp.watch(inPaths.html, ['nl_html']);
    gulp.watch(inPaths.css, ['nl_css']);
    gulp.watch(inPaths.scss, ['nl_css']);
    gulp.watch(inPaths.js, ['nl_js']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nl_generate_index']);
});


gulp.task('clean', function(done) {
    delFiles([outPath + '*'], function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
    });
});

gulp.task('nl_copy', ['nl_copy_extjs', 'nl_copy_extfonts', 'nl_copy_nittioold_ext', 'nl_copy_nittioold']);

gulp.task('nl_copy_extjs', function(done) {
    var extFiles = [inPaths.lib + 'ionic/js/ionic.bundle.js',
                    inPaths.lib + 'ydn-db/ydn.db-isw-core-qry.*'];
    gulp.src(extFiles)
    .pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_copy_extfonts', function(done) {
    gulp.src(inPaths.lib + 'ionic/fonts/*')
    .pipe(gulp.dest(outPath + 'lib/ionic/fonts'))
    .on('end', done);
});

gulp.task('nl_copy_nittioold_ext', function(done) {
    gulp.src(inPaths.lib + 'nittioold_ext/*.js')
    .pipe(concat('nittioold_ext.bundle.js'))
    //.pipe(gulp.dest(outPath))
    .pipe(uglify())
    .on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_copy_nittioold', function(done) {
    gulp.src(inPaths.lib + 'nittioold/*.js')
    .pipe(concat('nittioold.bundle.js'))
    .pipe(gulp.dest(outPath))
    .pipe(uglify())
    .on('error', swallowError)
    .pipe(rename({extname : '.min.js'}))
    //.pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_html', function(done) {
    gulp.src(inPaths.html)
    .pipe(angularTemplCache({filename: 'nl.html_fragments.js', module:'nl.html_fragments', standalone:true}))
    //.pipe(minifyHtml({empty:true, cdata:true, conditional:true, quotes:true, loose:true}))
    //.pipe(gulp.dest(outPath))
    .pipe(uglify())
    .pipe(rename({extname : '.min.js'}))
    .pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_css', function(done) {
    streamqueue({ objectMode: true }, gulp.src(inPaths.scss).pipe(sass()), gulp.src(inPaths.css))
    .pipe(concat('nl.bundle.css'))
    .pipe(gulp.dest(outPath))
    //.pipe(minifyCss({keepSpecialComments : 0}))
    //.pipe(rename({extname : '.min.css'}))
    //.pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_js', function(done) {
    gulp.src(inPaths.js)
    .pipe(order())
    .pipe(concat('nl.bundle.js'))
    .pipe(gulp.dest(outPath))
    //.pipe(uglify())
    //.on('error', swallowError)
    //.pipe(rename({extname : '.min.js'}))
    //.pipe(gulp.dest(outPath))
    .on('end', done);
});

gulp.task('nl_generate_index', function(done) {
    generateIndexHtml(done, './www', outUrlPath);
});

function generateIndexHtml(done, dest, prefix, suffix) {
    if (suffix === undefined) suffix = '';

    var jsList = [];
    jsList.push(prefix + 'ydn.db-isw-core-qry.js' + suffix);
    jsList.push(prefix + 'ionic.bundle.js' + suffix);
    if (suffix === '') jsList.push('cordova.js');
    jsList.push(prefix + 'nl.html_fragments.min.js' + suffix);
    jsList.push(prefix + 'nl.bundle.js' + suffix);
    
    gulp.src(inPaths.htmlTemplate + 'index_templ.html')
    .pipe(htmlreplace({nl_server_info: {
                           src: [[SERVER_URL, VERSIONS.script, VERSIONS.res, VERSIONS.icon, VERSIONS.template]], 
                           tpl: "<script>var NL_SERVER_INFO = {url: '%s', basePath: 'static/', versions: {script:'%s', res:'%s', icon:'%s', template:'%s'}};</script>"},
                       css: {
                           src: [prefix + 'nl.bundle.css' + suffix],
                           tpl: '<link rel="stylesheet" href="%s">'},
                       js: {
                           src: jsList,
                           tpl: '<script src="%s"></script>'}
                       }))
    .pipe(rename('index.html'))
    .pipe(gulp.dest(dest))
    .on('end', done);
}

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
var nittioBasePath = '../nittio/applications/nittiolearn';
var nittioScriptPath = nittioBasePath + outUrlPath;
var nittioViewPath = nittioBasePath + '/views/nittioapp';

function resourcePath(resType) {
    return '/static/nittio_' + resType + '_' + VERSIONS[resType] + '/';
}

function inResourcePath(resType) {
    return './www' + resourcePath(resType) + '**';
}

function nittioResourcePath(resType) {
    return nittioBasePath + resourcePath(resType);
}

function nittioCopyResouce(done, resType) {
    gulp.src(inResourcePath(resType))
    .pipe(gulp.dest(nittioResourcePath(resType)))
    .on('end', done);
}

gulp.task('nittio_clean', function(done) {
    delFiles([nittioResourcePath('res') + '*', 
              nittioResourcePath('icon') + '*', 
              nittioResourcePath('template') + '*', 
              nittioScriptPath + '*'], {force: true},  function(err, deletedFiles) {
        if (err) console.log('Error while deleting:', err);
        if (deletedFiles) console.log('' + deletedFiles.length + ' File(s) deleted.');
    });
});

gulp.task('nittio_build', ['nittio_copy_res', 'nittio_copy_icon', 'nittio_copy_template', 'nittio_copy_script', 'nittio_generate_index']);

gulp.task('nittio_watch', ['build', 'nittio_build', 'nl_watch'], function() {
    //------------------------------------------------------------------------------------------
    // Adding stuff does not work - so no point watch below folders
    //gulp.watch(inResourcePath('res'), ['nittio_copy_res']);
    //gulp.watch(inResourcePath('icon'), ['nittio_copy_icon']);
    //gulp.watch(inResourcePath('template'), ['nittio_copy_template']);
    //------------------------------------------------------------------------------------------
    gulp.watch(outPath + '**', ['nittio_copy_script']);
    gulp.watch(inPaths.htmlTemplate + '**', ['nittio_generate_index']);
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

gulp.task('nittio_copy_script', function(done) {
    gulp.src(outPath + '**')
    .pipe(gulp.dest(nittioScriptPath))
    .on('end', done);
});

gulp.task('nittio_generate_index', function(done) {
    var nittioUrlPrefix = "{{=mutils.scriptUrl('nlappjs/";
    var nittioUrlSuffix = "')}}";
    generateIndexHtml(done, nittioViewPath, nittioUrlPrefix, nittioUrlSuffix);
});
