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
2. Clone "nittioapp" repository from BitBucket
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
2. Run "karma start karma.conf.js" to run all unit testcases.
3. Under [nittioapp folder]/coverage folder you will see a directory per browser. Go into Chrome folder
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
5. Run "ionic platform add android"

Building Android App
====================
1. Test the application locally.
2. Open a shell/command prompt into the root folder of repository (nittioapp folder)
3. Build Android apk file using the command "ionic build android"
4. Your APK file will be found at [nittioapp filder]/platforms/android/ant-build/MainActivity-debug.apk
5. Transfer the file to your android device (e.g. Email the above file to your own email id and access
   the mail from phone)
6. Install the APK file on the device and run it



