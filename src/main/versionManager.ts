import ensureDirectoryAndFileExistence from './functions/dirFileExistence';

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');

const versionsFilePath = path.join(
    process.env.APPDATA,
    'nCraftLauncher',
    'versions.json',
);

// Function to fetch Minecraft versions
async function fetchVersions() {
    try {
        const response = await axios.get(
            'https://ncraft.nicolastech.xyz/mc/game/version_manifest.json',
        );
        return response.data;
    } catch (err) {
        // Handle errors
        console.error('Error fetching versions:', err);
        return [];
    }
}

// Function to read versions from the JSON file
function readVersions() {
    try {
        ensureDirectoryAndFileExistence(versionsFilePath); // Ensure directory and file existence
        const versionsData = fs.readFileSync(versionsFilePath);
        return JSON.parse(versionsData);
    } catch (err) {
        // Handle errors
        console.error('Error reading versions file:', err);
        return [];
    }
}

// Function to write versions to the JSON file
function writeVersions(versions: any) {
    try {
        ensureDirectoryAndFileExistence(versionsFilePath); // Ensure directory and file existence
        const versionsJSON = JSON.stringify(versions, null, 2);
        fs.writeFileSync(versionsFilePath, versionsJSON);
    } catch (err) {
        // Handle errors
        console.error('Error writing versions file:', err);
    }
}

// Fetch versions and write to the file on startup
async function init() {
    const versions = await fetchVersions();
    writeVersions(versions);
}

init();

// Define IPC event handlers to communicate with renderer process
ipcMain.handle('readVersions', () => {
    return readVersions();
});

ipcMain.handle('fetchAndWriteVersions', async () => {
    const versions = await fetchVersions();
    writeVersions(versions);
    return versions;
});
