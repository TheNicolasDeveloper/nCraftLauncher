// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';

ipcRenderer
    .invoke('readProfiles')
    .then((profilesraw: any) => {
        const { profiles } = profilesraw;
        ipcRenderer
            .invoke('readVersions')
            .then((versions: any) => {
                const latestRelease = versions.latest.release;
                const latestSnapshot = versions.latest.snapshot;

                // update the latest and latest-snapshot to the actual version numbers
                // eslint-disable-next-line no-restricted-syntax
                const updatedProfiles = profiles.map((element: any) => {
                    if (element.id === 1) {
                        return { ...element, version: latestRelease };
                    }
                    if (element.id === 2) {
                        return { ...element, version: latestSnapshot };
                    }
                    return element;
                });

                ipcRenderer.invoke('writeProfiles', {
                    profiles: {
                        ...profilesraw,
                        profiles: updatedProfiles,
                    },
                });

                return versions;
            })
            .catch((error: any) => {
                console.error('Error updating version numbers:', error);
            });

        return profiles;
    })
    .catch((error: any) => {
        console.error('Error fetching profiles:', error);
    });

contextBridge.exposeInMainWorld('api', {
    invoke: (channel: string, data: any) => {
        const validChannels = [
            'readProfiles',
            'writeProfiles',
            'fetchAndWriteVersions',
            'readVersions',
            'readProfile',
            'updateCurrentProfile',
            'mcLaunch',
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
        // Add a return statement here to handle the case when the if condition is not met
        return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
    on: (channel: string, func: (...args: any[]) => void) => {
        const validChannels = ['mcLaunchState', 'downloadProgress'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
        // Add a return statement here to handle the case when the if condition is not met
        return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
});
