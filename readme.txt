Cloning the repository
======================
Background:
-----------
We use mercurial (Hg) for mananging the different version of our code. Mercurial is a distributed revision 
control system. We use TortoiseHg which is a GUI for accessing the mercurial code repository. Developers 
make changes and "commit" the changes to the repository.
With any distributed version control system, a copy of complete repository is stored in each developer's machine.
If one developer commits a change it is not automatically visisble to others. To share the repository changes
across developers we use a central repository hosting service called "BitBucket". Every developer needs access
to BitBucket to wdownload the repository and later to push changes to and pull changes from central repository.

Needed first time setup steps:
------------------------------
1. Download and install TortoiseHg from http://tortoisehg.bitbucket.org/download/
2. Open TortoiseHg Workbench
3. Setup your BitBucket credentials so that password are not asked every time:
   - Choose the menu "File -> Settings". Press "Edit File" button.
   - Under UI ([UI]) section add:
   -- username = Your Name <yourname@nittio.com>
   - Under Auth ([Auth]) section add:
   -- bitbucket.org.prefix = bitbucket.org
   -- bitbucket.org.username = <your bitbucket username>
   -- bitbucket.org.password = <your bitbucket password>
   - Press Save. Press OK.
4. Create new repository: 
   - Choose the menu "File -> New Repository"
   - In "Destination Path" choose location where you want to place the repository. Make sure the last part of 
     your repository name is "nittioapp". If you want to keep the repository directly under folder "c:\users\xxx", 
     please enter "c:\users\xxx\nittioapp"
   - You would need to do the same for the "nittio" repository too.
5. Synchronize repository content
   - Click on View->Synchronize menu option
   - Set remote repository URL https://bitbucket.org/nittio/nittioapp
   - Save this as default
   - Click the tool bar icon with hover text "Pull incomming changes from selected URL"
   - You might need to "update" the latest version of pulled changes - otherwise you might be
     seeing still older version (which is version 0).
6. Open a shell/command prompt into the root folder of "nittioapp" repository (nittioapp folder).
7. Run "npm install" to update the needed node modules.
8. Run "gulp rebuild" to build the nittioapp first time.

Syncing your code to latest code
================================
1. Open TortoiseHg Workbench
2. Synchronize repository content
   - If you had done changes, please ensure that your changes are checked in before you pull.
   - Click the tool bar icon with hover text "Pull incomming changes from selected URL"
   - If you did not make any changes in your machine, you need to "update" the latest version
     of pulled changes - otherwise you will be seeing still older version.
   - If you had changes, you need to "merge" the latest version to your local version.
   - This syncing has to be done for both "nittio" and "nittioapp" folders.
3. Open a shell/command prompt into the root folder of "nittioapp" repository (nittioapp folder).
4. Run "npm install" to update the needed node modules. (If needed - if you are doing this
   after a long time, it is likely that one of your team members have installed few more npm
   modules meanshile).
5. Run "gulp rebuild" to build the nittioapp after the pull.
6. If you notice the changes in the "nittio", you might see some generated modules. Checkin
   changes in both nittio and nittioapp folders and push them to central repository.

Some important Google Dev Console URLs
======================================

Login as hello@nittio.com in a browser to access the google dev console URLs

- Google Dev Console Home:
  https://console.cloud.google.com/home/dashboard?project=nittio-live
  In the top bar you can change the project from "nittio-live" to "nittio-test". Be aware
  all the time of the project you are viewing. Below are important links inside
  
- Checking on the logs
  Stack Driver / Logging -> Logs
  
- Setting a new version as default version
  App Engine -> Versions -> check the version -> Migrate traffic
  
- Check if quota has run out (e.g. for nittio_test project)
  App Engine -> Quotas
  
- See monthly billing and budgets:
  Billing -> Budget and alerts
  Currently monthly billing budget is 100$. You get a mail at 50% and 90% limits.
  If the 50% is spent much before half the month, budget needs to be updated
  accordingly.
  Also note that there is a daily App Engine Limit of 20$ set in app engine
  App Engine -> Dashboard. You may want to tweek this when the usage is much higher.
  
- Uploading AD Sync related stuffs:
  https://console.cloud.google.com/storage/browser/nittio-live.appspot.com/_public/nlloader/?project=nittio-live


Before sending new minor version for testing
============================================
To make any changes and release a minor version (pre-release) for testing, do the following:
1. In the nittioapp project, do the following:
   - gulpfile.js: Increment the minor version number (e.g. v73 -> v74.pre01; v74.pre01 -> v74.pre02)
   - gulp rebuild
   - check in sources
   - Apply the new minor version tag (v74.per01) to the last checked in sources
2. In the nittio project, do the following:
   - app.yaml: Ensure that the application field is 'nittio-test'
   - check in sources (including generated files)
   - Apply the new minor version tag (v74.per01) to the last checked in sources
3. Use Google app engine launcher to upload the latest software.

Releasing a version in nittio-live
==================================
1. In the nittioapp project, do the following:
   - gulpfile.js: Change the version number to latest major version (e.g. v74.pre04 -> v74)
   - gulp rebuild
   - check in sources
   - Apply the version tag (e.g. v74) to the last checked in sources
2. In the nittio project, do the following:
   - check in sources (including generated files)
   - modify app.yaml - application = nittio-live
   - upload software to GAE
   - undo modification in app.yaml
3. At GAE console, change the serving version to latest updated version
4. Quickly verify that the new software is working
5. In the nittioapp project, do the following:
   - gulpfile.js: Change the version number to new minor version (e.g. v74 -> v75.pre01)
   - gulp rebuild
   - check in sources
6. In the nittio project, do the following:
   - app.yaml: Increment the version number (e.g. 74 -> 75)
   - app.yaml: Ensure that the application field is 'nittio-test'
   - check in sources (including generated files)
7. Push changes to central repository (both nittio and nittioapp repos)

NittioApp folder structure
==========================
1. Files you will not normally update manually
----------------------------------------------
0. readme.txt: this file.
1. .hg*: Mercurial related files. Automatically managed. Don't manually edit.
2. .project: Aptana file. Automatically managed. Don't manually edit.
3. bower.json: Bower is not used in the project. Gulp is used.
4. config.xml: Cordova related file. Used when code is bundled as Android/IOS app.
5. ionic.project: Ionic file. Automatically managed.
6. package.json: Managed by npm - "npm install" works based on this file.
7. coverage/*: not checked into repository - generated by "Istanbul" when the Karma testcases are run.
8. hooks/*: cordova hooks called in different stages of App bundling. "030_nl_after_preapre.js" is our hook.
9. node_modules/*: not checked into repository - managed by npm - run "npm install" to update this folder.
10. platforms/plugins: Cordova/ionic related forlders used in app bundling.
11. resources: Cordova/ionic related forlder for app icons
12. www/extern: ionic/angular related files

2. Editable files
-----------------
1. gulpfile.js: gulp configuration file for project building. Gulp is something like make/ant of the android world.
2. karma.conf.js: Karma test runner configuration file.
3. www/_code/*: actual code - js/css/html
4. www/_htmlTemplate/*: template for index.html. index.html is generated by a gulp task (see gulpfile.js)
5. www/_imgSources/*: sources (e.g. GIMP files) used in creating app icons
6. www/_manifest/*: manifest file for html app cache
7. www/_serverapi/*: Dummy JSON files simulating server responses to enable local testing of the app
8. www/_test/*: Karma/Jasmine testcases
9. www/static/nittio_icon*: lesson icons
10. www/static/nittio_template*: lesson background images
11. www/static/nittio_res*: app icons (e.g. menu icons)
12. www/static/nittio_script*: bundled javascript/html/css generated from _code folder (by gulp).





