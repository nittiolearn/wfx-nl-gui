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
   - Under 'UI' section add:
   -- username = Your Name <yourname@nittio.com>
   - Under 'Auth' section add:
   -- bitbucket.org.prefix = bitbucket.org
   -- bitbucket.org.username = <your bitbucket username>
   -- bitbucket.org.password = <your bitbucket password>
   - Press Save. Press OK.
4. Create new repository: 
   - Choose the menu "File -> New Repository"
   - In "Destination Path" choose location where you want to place the repository. Make sure the last part of 
     your repository name is "nittioapp". If you want to keep the repository directly under folder "c:\users\xxx", 
     please enter "c:\users\xxx\nittioapp"
5. Synchronize repository content
   - Click on View->Synchronize menu option
   - Set remote repository URL https://bitbucket.org/nittio/nittioapp
   - Save this as default
   - Click the tool bar icon with hover text "Pull incomming changes from selected URL"
6. Open a shell/command prompt into the root folder of repository (nittioapp folder).
7. Run "npm install" to update the needed node modules.
8. Run "gulp rebuild" to build the nittioapp first time.

Syncing your code to latest code
================================
1. Open TortoiseHg Workbench
2. Synchronize repository content
   - Click the tool bar icon with hover text "Pull incomming changes from selected URL"
3. Open a shell/command prompt into the root folder of repository (nittioapp folder).
4. Run "npm install" to update the needed node modules.
5. Run "gulp rebuild" to build the nittioapp first time.

Running the app on your machine
===============================
1. Open a shell/command prompt into the root folder of repository (nittioapp folder).
2. Run "ionic serve" to launch the app in a browser.

Unit testing the app on your machine
====================================
1. Open a shell/command prompt into the root folder of repository (nittioapp folder).
2. Run "gulp karma" to run all unit testcases in chrome browser.
3. Once all tests are through, "gulp karma_all" to run all unit testcases in all configured browsers.
4. Under [nittioapp folder]/coverage folder you will see a directory per browser. Go into Chrome folder
   and click on index.html. This shows the code coverage achieved with your tests.

Setting up android platform
===========================
nittioapp can be built as a native andriod app (i.e. generate a .apk file which can be installed in android device).
To do this, you have to do the following:

1. Install Android SDK (https://developer.android.com/sdk/installing/index.html - choose "Stand-alone SDK tools")
2. Run the Android SDK Manager (tool name: android)
3. Download and install the below packages in the SDK Manager:
   - Android SDK Tools (Under Tools folder)
   - Android SDK Build Tools Revision 21.*.* (Under Tools folder)
   - SDK Platform for API version 21 (Under Android 5.0.1 API 21 folder)
4. Open a shell/command prompt into the root folder of repository (nittioapp folder).
5. Run "ionic platform remove android"
6. Run "ionic platform add android"

Building Android App
====================
1. Test the application locally.
2. Open a shell/command prompt into the root folder of repository (nittioapp folder)
3. Build Android apk file using the command "ionic build android"
4. Your APK file will be found at [nittioapp filder]/platforms/android/ant-build/MainActivity-debug.apk
5. Transfer the file to your android device (e.g. Email the above file to your own email id and access
   the mail from phone)
6. Install the APK file on the device and run it

Creating new nittio version
===========================
After a version of nittio is uploaded into live, do the following steps to create a new nittio version:
1. In the nittio project, do the following:
   - Apply the old version tag (e.g. v66) to the last checked in sources
   - app.yaml: Increment the version number (e.g. 66 -> 67)
   - app.yaml: Ensure that the application field is 'nittio-test'
   - mutils.py: Increment the version number (e.g. v66 -> v67)
   - "hg rename" the static/nittio_script_* folder (e.g. from nittio_script_v66 -> nittio_script_v67)
2. In the nittio project, do the following:
   - Apply the old version tag (e.g. v66) to the last checked in sources
   - gulpfile.js: Increment the version number (e.g. v66 -> v67)
   - gulp clean
   - gulp rebuild
   - gulp nittio
3. Check in changes in both folders; push changes to remote

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





