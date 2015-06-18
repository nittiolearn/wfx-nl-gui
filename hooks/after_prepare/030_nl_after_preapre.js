#!/usr/bin/env node

/**
 * After prepare, files are copied to the platforms/ios and platforms/android folders.
 * Cleaning up unnecessary files and updating index.html
 */
var SERVER_URL = '/';

var fs = require('fs');
var path = require('path');

//-------------------------------------------------------------------------------------------------
var deleteFolderRecursive = function(removePath) {
  if( fs.existsSync(removePath) ) {
    fs.readdirSync(removePath).forEach(function(file,index){
      var curPath = path.join(removePath, file);
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(removePath);
  }
};

var deleteStaticFolder = function() {
    var deleteFolders = ['/www/static/nittio_icon_v41', '/www/static/nittio_template_v35']
    for (var i in deleteFolders) {
        var iosPlatformsDir = path.resolve(__dirname, '../../platforms/ios' + deleteFolders[i]);
        var androidPlatformsDir = path.resolve(__dirname, '../../platforms/android/assets' + deleteFolders[i]);
        deleteFolderRecursive(iosPlatformsDir);
        deleteFolderRecursive(androidPlatformsDir);
    }
};

//-------------------------------------------------------------------------------------------------
var findServerInfo = function(html) {
    try {
        return html.match(/NL_SERVER_INFO \= \{url\: \'\/\'/g)[0];
    }
    catch(e) {
    }
};

var updateHtml = function(htmlFilePath) {
    var html = fs.readFileSync(htmlFilePath, 'utf8');
    var serverInfo = findServerInfo(html);
    console.log('Server info:', serverInfo);
    var newServerInfo = serverInfo.replace("url: '/'", "url: '" + SERVER_URL + "'");
    console.log('New server info:', newServerInfo);
    html = html.replace(serverInfo, newServerInfo);
    console.log('New html:', html);
    fs.writeFileSync(htmlFilePath, html, 'utf8');
};

var updateIndexHtml = function() {
    var iosPath = path.resolve(__dirname, '../../platforms/ios/www/index.html');
    var androidPath = path.resolve(__dirname, '../../platforms/android/assets/www/index.html');
    console.log('paths:', iosPath, androidPath);
    //updateHtml(iosPath);
    updateHtml(androidPath);
};

console.log('------------------------------------------------------------------------------');
console.log('030_nl_after_prepare.js', process.argv);
deleteStaticFolder();
updateIndexHtml();
console.log('------------------------------------------------------------------------------');
