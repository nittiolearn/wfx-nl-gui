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

