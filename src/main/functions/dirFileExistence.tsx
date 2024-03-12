const fs = require('fs');
const path = require('path');

export default function ensureDirectoryAndFileExistence(
    profilesFilePath: string,
) {
    const directoryPath = path.dirname(profilesFilePath);
    try {
        // Ensure directory exists
        fs.mkdirSync(directoryPath, { recursive: true });
        // Ensure file exists
        if (!fs.existsSync(profilesFilePath)) {
            fs.writeFileSync(profilesFilePath, '{}');
        }
    } catch (err) {
        // Handle errors
        console.error('Error ensuring directory and file existence:', err);
    }
}
