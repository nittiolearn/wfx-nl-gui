# TODO

remove all nittio-web related code

# Getting Started

1. This repo is stored in github. Please use your **nittio github account** to clone this repo from https://github.com/nittiolearn/nittioapp.git
1. This repo needs node, npm and gulp installed. The node version should be v11 or older. The latest lts version of node v10 is recomended. At the time of writing this document, it is v10.23.0. 
1. npm install --global gulp-cli
1. From the root folder of this project:
   1. rm -rf node_modules package-lock.json
   1. npm install
1. For testing this repo, you will also need to pull the nittio repo. Make sure nittio and nittioapp are sibling folders in your local machine. Clone the nittio repo from https://github.com/nittiolearn/nittio.git
1. Now you are setup. run "gulp" from the root folder and it should build the nittioapp project and copy required bundled/minified files to nittio repo.
1. It is a good idea to add nittio and nittioapp repos to the same visual code workspace.

# Testing locally
1. From nittioapp repo root folder, run gulp in one terminal. 
1. Once you see the message "Finished 'default' after xx s", you can be sure that needed html, css, js, images are copied to nittio repo. Notice what has changed in the nittio repo (changes in git view). Gulp keeps watching for changes and will keep building automatically as you save your code. If there is change in the gulpfile itself or if new files are added to the repo, you need to restart gulp.
1. From nittio repo root folder, run "python web2py.py" in one terminal (this needs Python 2.7 installed).
1. This will start web2py server in 127.0.0.1:8000 by default.
1. Once you login, from a new tab in the same window, execute the url "127.0.0.1:8000/nittio_admin/debug?debug_scripts=1". This will ensure that scripts are debuggable and not minified. 
1. Now refresh the page and you can debug / put breakpoints in nl.bundle.js.

# Deploying to google app engin
1. Change the version number in gulpfile.js (e.g. change v187_pre04 => v187_pre05)
1. restart gulp
1. Take a shell in nittio repo root folder and excute bellow command
1. python gaedeploy.py <version> <app_engine_project>
1. for example:
   1. python gaedeploy.py 187 nittio-test

# NittioApp folder structure

A files are in www folder. _code folder has angular code. _code_old has old jQuery code.




