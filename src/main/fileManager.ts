import ensureDirectoryAndFileExistence from './functions/dirFileExistence';

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

// Path to the profiles JSON file
const profilesFilePath = path.join(
    process.env.APPDATA,
    'nCraftLauncher',
    'profiles.json',
);

// Function to read profiles from the JSON file
function readProfiles() {
    try {
        ensureDirectoryAndFileExistence(profilesFilePath); // Ensure directory and file existence
        const profilesData = fs.readFileSync(profilesFilePath);
        return JSON.parse(profilesData);
    } catch (err) {
        // Handle errors
        console.error('Error reading profiles file:', err);
        return [];
    }
}

// Function to write profiles to the JSON file
function writeProfiles(profilesarr: any) {
    try {
        ensureDirectoryAndFileExistence(profilesFilePath); // Ensure directory and file existence
        const profilesJSON = JSON.stringify(profilesarr, null, 2);
        fs.writeFileSync(profilesFilePath, profilesJSON);
    } catch (err) {
        // Handle errors
        console.error('Error writing profiles file:', err);
    }
}

// Function to fetch profiles
function readProfile(id: number) {
    const { profiles } = readProfiles();

    // eslint-disable-next-line eqeqeq
    return profiles.find((profile: any) => profile.id == id);
}

function updateCurrentProfile(id: number) {
    const profiles = readProfiles();
    profiles.currentProfile = id;
    writeProfiles(profiles);
}

const profiles = readProfiles();
if (!profiles || !profiles.profiles || profiles.profiles.length < 2) {
    writeProfiles({
        currentProfile: 1,
        profiles: [
            {
                id: 1,
                name: 'Latest Release',
                version: '1.20.4',
            },
            {
                id: 2,
                name: 'Latest Snapshot',
                version: '24w09a',
            },
        ],
    });
}

// Define IPC event handlers to communicate with renderer process
ipcMain.handle('readProfiles', () => {
    return readProfiles();
});

ipcMain.handle('readProfile', (event, id: number) => {
    return readProfile(id);
});

ipcMain.handle('writeProfiles', (event, args) => {
    writeProfiles(args.profiles);
});

ipcMain.handle('updateCurrentProfile', (event, id: number) => {
    updateCurrentProfile(id);
});
