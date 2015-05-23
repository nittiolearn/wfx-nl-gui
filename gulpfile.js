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

var inPaths = {
    lib: './www/_extern/',
    html : './www/_code/**/*.html',
    css : './www/_code/css/*.css',
    scss : './www/_code/css/*.scss',
    js : './www/_code/**/*.js'
};

var outPath = './www/js/';

function swallowError(error) {
    console.log(error.toString());
    this.emit('end');
}

gulp.task('default', ['nl_html', 'nl_css', 'nl_js', 'nl_watch']);

gulp.task('nl_watch', function() {
    gulp.watch(inPaths.html, ['nl_html']);
    gulp.watch(inPaths.css, ['nl_css']);
    gulp.watch(inPaths.scss, ['nl_css']);
    gulp.watch(inPaths.js, ['nl_js']);
});

gulp.task('rebuild', ['nl_copy', 'nl_html', 'nl_css', 'nl_js']);

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
    .pipe(concat('nl.bundle.js'))
    .pipe(gulp.dest(outPath))
    //.pipe(uglify())
    //.on('error', swallowError)
    //.pipe(rename({extname : '.min.js'}))
    //.pipe(gulp.dest(outPath))
    .on('end', done);
});
