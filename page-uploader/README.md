# Page Uploader

## What it is?
This electron application lets you upload archive files to S3 to be processed and digitised.
The use of this tool is restricted to FT Staff and requires authentication.


## Things that are restricted
- You need to be authenticated (you can go through the authentication process within the app)
- If your aim is to upload files for the FT Archive, you should be using the compiled application, not run the source
- The files to upload can only be XML or JPG, and need to have a valid name format
- The compiled application is for Mac only at the moment

## For developers

### Settings
Before compiling the application, ensure you fill in the relevant information in `keys.js`, regarding the bucket name, bucket region, and authenticator URL. These can be found in the project document (P42).
To run the application without compiling, you need a `.env` file with the same variables. (Run `npm start` after creating your environment variables).

Add the icons in a `build` folder (these can also be found in the project document).

Ensure the intended user are white-listed in the authenticator (see P43).

### How to compile the application
Ensure you create a self-signed certificate ([Intructions from Apple](https://support.apple.com/kb/PH20131)) from your key chain (and set it to always trust). Create a `dist` folder at the root, then run `npm run dist`. The compiled application will appear in the `dist` folder.

The latest version of the compiled application can be found in the project folder, so ensure you replace it there before distributing it.


_Note: This is originally based off [Electron Quick Start](https://github.com/electron/electron-quick-start)_