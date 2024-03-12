import { log } from 'console';
import { ipcMain, webContents, app } from 'electron';

const AdmZip = require('adm-zip');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let totalBytes = 0;
let downloadedBytes = 0;

async function calculateMD5(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);

        stream.on('error', reject);

        stream.on('data', (chunk: any) => {
            hash.update(chunk);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
    });
}

async function extractNatives(
    nativesZipPath: string,
    destination: string,
): Promise<void> {
    const zip = new AdmZip(nativesZipPath);
    zip.extractAllTo(destination, true);
}

async function extractJava(
    javaZipPath: string,
    destination: string,
): Promise<void> {
    const zip = new AdmZip(javaZipPath);
    zip.extractAllTo(destination, true);
}

async function fetchGET(url: string) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (err) {
        // Handle errors
        console.error('Error fetching versions:', err);
        return 'error';
    }
}

async function downloadFile(url: string, destination: string): Promise<void> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
        },
    });

    const writer = fs.createWriteStream(destination);

    response.data.on('data', (chunk: any) => {
        downloadedBytes += chunk.length;
        const progress = (downloadedBytes / totalBytes) * 100;
        // Send progress to the client
        if (webContents.getFocusedWebContents()) {
            webContents
                .getFocusedWebContents()!
                .send('downloadProgress', progress);
        }
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function downloadMinecraftVersion(versionData: any): Promise<void> {
    const webContent = webContents.getFocusedWebContents();
    const basepath = path.join(process.env.APPDATA, 'nCraftLauncher');

    if (!fs.existsSync(basepath)) {
        fs.mkdirSync(basepath);
    }

    if (!fs.existsSync(path.join(basepath, '.minecraft'))) {
        fs.mkdirSync(path.join(basepath, '.minecraft'));
    }

    if (!fs.existsSync(path.join(basepath, '.minecraft', 'versions'))) {
        fs.mkdirSync(path.join(basepath, '.minecraft', 'versions'));
    }

    const versionBasePath = path.join(
        basepath,
        '.minecraft',
        'versions',
        versionData.id,
    );
    if (!fs.existsSync(versionBasePath)) {
        fs.mkdirSync(versionBasePath);
    }

    const assetsPath = path.join(basepath, '.minecraft', 'assets');
    if (!fs.existsSync(path.join(assetsPath))) {
        fs.mkdirSync(path.join(assetsPath));
    }

    const { assetIndex } = versionData;
    const assetIndexPath = path.join(
        assetsPath,
        'indexes',
        `${versionData.id}.json`,
    );

    if (!fs.existsSync(path.join(assetsPath, 'indexes'))) {
        fs.mkdirSync(path.join(assetsPath, 'indexes'), { recursive: true });
    }
    const assetsData = await fetchGET(assetIndex?.url);

    const javaDownloads = await fetchGET(
        'https://ncraft.nicolastech.xyz/java/versions',
    );

    const arch = process.arch === 'x64' ? 'x64' : 'x32';
    const system2 = process.platform === 'darwin' ? 'mac-os' : 'linux';
    const system = process.platform === 'win32' ? 'windows' : system2;

    const fullArchSystem = `${system}-${arch}`;

    const javaVersion = versionData.javaVersion.majorVersion;

    log(`Downloading ${fullArchSystem} version ${javaVersion}`);

    const filesToDownload = [
        {
            url: versionData.downloads.client.url,
            path: path.join(versionBasePath, `${versionData.id}.jar`),
            size: versionData.downloads.client.size || 0,
        },
        ...versionData.libraries
            .map((library: any) => {
                if (
                    library.downloads &&
                    library.downloads.artifact &&
                    library.downloads.artifact.url
                ) {
                    return {
                        url: library.downloads.artifact.url,
                        path: path.join(
                            basepath,
                            '.minecraft',
                            'libraries',
                            library.downloads.artifact.path,
                        ),
                        size: library.downloads.artifact.size || 0,
                    };
                }
                if (library.downloads && library.downloads.classifiers) {
                    // Handle libraries with classifiers
                    return Object.keys(library.downloads.classifiers).map(
                        (key: string) => ({
                            url: library.downloads.classifiers[key].url,
                            path: path.join(
                                basepath,
                                '.minecraft',
                                'libraries',
                                library.downloads.classifiers[key].path,
                            ),
                            size: library.downloads.classifiers[key].size || 0,
                        }),
                    );
                }
                // Handle other cases where downloads.artifact is missing
                console.error(
                    'Missing expected properties in library:',
                    JSON.stringify(library, null, 2),
                );
                // Return null or provide a default value
                return null;
            })
            .filter((library: any) => library !== null),

        {
            size: versionData.assetIndex.size || 0,
        },
        ...(assetsData.objects
            ? Object.keys(assetsData.objects).map((key: string) => ({
                  url: `https://resources.download.minecraft.net/${assetsData.objects[
                      key
                  ].hash.substring(0, 2)}/${assetsData.objects[key].hash}`,
                  path: path.join(versionBasePath, 'assets', key),
                  size: assetsData.objects[key].size || 0,
              }))
            : []),
        {
            url: javaDownloads[fullArchSystem][javaVersion].url,
            size: javaDownloads[fullArchSystem][javaVersion].size || 0,
        },
    ];

    filesToDownload.forEach(({ size }) => {
        if (size) {
            totalBytes += size;
        }
    });

    log(`Total bytes to download: ${totalBytes}`);

    // download client JAR
    if (webContent) {
        webContent.send('mcLaunchState', 'downloadingJar');
    }

    if (!fs.existsSync(path.join(versionBasePath, `${versionData.id}.jar`))) {
        // eslint-disable-next-line no-await-in-loop
        await downloadFile(
            versionData.downloads.client.url,
            path.join(versionBasePath, `${versionData.id}.jar`),
        );
    } else {
        // remove the size so it seems like it has been downloaded
        totalBytes -= versionData.downloads.client.size || 0;
    }

    // download libraries
    if (webContent) {
        webContent.send('mcLaunchState', 'downloadingLibraries');
    }

    const librariesDir = path.join(basepath, '.minecraft', 'libraries');
    if (!fs.existsSync(librariesDir)) {
        fs.mkdirSync(librariesDir);
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const library of versionData.libraries) {
        // Check if the library has downloads.artifact property
        if (
            library.downloads &&
            library.downloads.artifact &&
            library.downloads.artifact.url
        ) {
            // Handle libraries with artifact downloads
            const { artifact } = library.downloads;
            const libraryPath = artifact.path; // Use the original path without replacing slashes

            const libraryFullPath = path.join(librariesDir, libraryPath);
            const libraryDir = path.dirname(libraryFullPath);

            // Create nested directories if they don't exist
            if (!fs.existsSync(libraryDir)) {
                fs.mkdirSync(libraryDir, { recursive: true });
            }

            // Download the file
            if (!fs.existsSync(libraryFullPath)) {
                // eslint-disable-next-line no-await-in-loop
                await downloadFile(artifact.url, libraryFullPath);
            } else {
                // Remove the size so it seems like it has been downloaded
                totalBytes -= library.downloads.artifact.size;
            }
        } else if (library.downloads && library.downloads.classifiers) {
            // Handle libraries with classifiers
            const { classifiers } = library.downloads;
            // eslint-disable-next-line no-restricted-syntax
            for (const classifier in classifiers) {
                // eslint-disable-next-line no-prototype-builtins
                if (classifiers.hasOwnProperty(classifier)) {
                    const classifierUrl = classifiers[classifier].url;
                    const classifierPath = classifiers[classifier].path;

                    const classifierFullPath = path.join(
                        librariesDir,
                        classifierPath,
                    );
                    const classifierDir = path.dirname(classifierFullPath);

                    // Create nested directories if they don't exist
                    if (!fs.existsSync(classifierDir)) {
                        fs.mkdirSync(classifierDir, { recursive: true });
                    }

                    // Download the classifier file
                    if (!fs.existsSync(classifierFullPath)) {
                        // eslint-disable-next-line no-await-in-loop
                        await downloadFile(classifierUrl, classifierFullPath);

                        // extract the natives and put them into the versions/currentversion/natives directory
                        // eslint-disable-next-line no-await-in-loop
                        await extractNatives(
                            classifierFullPath,
                            path.join(versionBasePath, 'natives'),
                        );

                        // delete the META-INF folder
                        fs.rmSync(
                            path.join(versionBasePath, 'natives', 'META-INF'),
                            {
                                recursive: true,
                                force: true,
                            },
                        );
                    } else {
                        // Remove the size so it seems like it has been downloaded
                        totalBytes -= classifiers[classifier].size;
                    }
                }
            }
        } else {
            // Handle other cases where downloads.artifact is missing
            console.error('Missing expected properties in library:', library);
        }
    }

    if (webContent) {
        webContent.send('mcLaunchState', 'checkingBuiltInJava');
    }

    const javaInstallationPath = path.join(
        basepath,
        'java',
        `${fullArchSystem}-${javaVersion}`,
    );
    const javaInstalled = fs.existsSync(javaInstallationPath);
    let reinstallJava = false;

    if (javaInstalled) {
        if (!fs.existsSync(path.join(javaInstallationPath, 'hash'))) {
            reinstallJava = true;
        } else {
            const javaHash = fs
                .readFileSync(path.join(javaInstallationPath, 'hash'))
                .toString();
            const expectedHash =
                javaDownloads[fullArchSystem][javaVersion].hash;

            if (javaHash !== expectedHash) {
                // Hash mismatch, need to reinstall Java
                reinstallJava = true;
            }
        }
    }

    // Download and install Java
    if (webContent) {
        webContent.send('mcLaunchState', 'downloadingBuiltInJava');
    }

    if (!javaInstalled || reinstallJava) {
        // Java not installed or hash mismatch, download and install Java
        if (
            javaDownloads &&
            javaDownloads[fullArchSystem] &&
            javaDownloads[fullArchSystem][javaVersion]
        ) {
            const javaDownload = javaDownloads[fullArchSystem][javaVersion];
            const javaDestination = path.join(
                basepath,
                `java-temp-${javaVersion}-${Math.random()}.zip`,
            );

            log(`Downloading Java ${javaVersion} for ${fullArchSystem}`);

            // Download Java
            await downloadFile(javaDownload.url, javaDestination);

            log(`Java ${javaVersion} downloaded successfully`);

            // Verify MD5 hash of the downloaded Java zip
            const downloadedJavaHash = await calculateMD5(javaDestination);

            if (downloadedJavaHash !== javaDownload.hash) {
                console.error(
                    `Downloaded Java ${javaVersion} hash does not match expected hash`,
                );
                // decrement the totalBytes
                totalBytes -= javaDownloads[fullArchSystem][javaVersion].size;
                // Handle hash mismatch error
                return;
            }

            // Extract Java
            log(`Extracting Java ${javaVersion}`);
            await extractJava(javaDestination, javaInstallationPath);
            log(`Java ${javaVersion} extracted successfully`);

            // Write hash to file
            fs.writeFileSync(
                path.join(javaInstallationPath, 'hash'),
                downloadedJavaHash,
            );

            // delete the zip
            fs.unlinkSync(javaDestination);
        } else {
            log(`Java ${javaVersion} for ${fullArchSystem} not found`);
            // decrement the totalBytes
            totalBytes -= javaDownloads[fullArchSystem][javaVersion].size;
        }
    } else {
        log(`Java ${javaVersion} is already installed and up to date`);
        // decrement the totalBytes
        totalBytes -= javaDownloads[fullArchSystem][javaVersion].size;
    }

    const javaPath = path.join(javaInstallationPath, 'bin', 'java.exe');

    // Download assets
    if (webContent) {
        webContent.send('mcLaunchState', 'downloadingAssets');
    }

    fs.writeFileSync(assetIndexPath, JSON.stringify(assetsData));

    const assetsObjectPath = path.join(assetsPath, 'objects');
    if (!fs.existsSync(assetsObjectPath)) {
        fs.mkdirSync(assetsObjectPath);
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const key in assetsData.objects) {
        if (Object.hasOwn(assetsData.objects, key)) {
            const asset = assetsData.objects[key];

            const savePath = path.join(
                assetsObjectPath,
                asset.hash.substring(0, 2),
            );

            // check if the file already exists
            if (!fs.existsSync(path.join(savePath, asset.hash))) {
                // make sure to create the directory if it doesn't exist
                if (!fs.existsSync(path.join(savePath))) {
                    fs.mkdirSync(path.join(savePath), {
                        recursive: true,
                    });
                }

                const assetUrl = `https://ncraft.nicolastech.xyz/resources/${asset.hash.substring(
                    0,
                    2,
                )}/${asset.hash}`;

                // eslint-disable-next-line no-await-in-loop
                await downloadFile(assetUrl, path.join(savePath, asset.hash));
            } else {
                // decrement the size so it seems like it has been downloaded
                totalBytes -= assetsData.objects[key].size;
            }
        }
    }

    if (webContent) {
        webContent.send('mcLaunchState', 'done');
    }

    // reset!
    downloadedBytes = 0;
    totalBytes = 0;

    if (webContent) {
        webContent.send('downloadProgress', 0);
    }

    // attempt to launch mc
    if (webContent) {
        webContent.send('launchMinecraft');
    }

    try {
        const jarPath = path.join(versionBasePath, `${versionData.id}.jar`);

        const versionName = versionData.id;

        const gameDirectory = path.join(basepath, '.minecraft');

        const assetsRoot = path.join(basepath, '.minecraft', 'assets');

        const authUuid = '00000000-0000-0000-0000-000000000000';
        const authAccessToken = '0';
        const authPlayerName = `nCraftTest${Math.floor(
            Math.random() * 100000,
        )}`;
        const userType = 'mojang';

        const libraries = versionData.libraries
            .filter(
                (lib: { downloads: { artifact: any } }) =>
                    lib.downloads?.artifact,
            )
            .map((lib: { downloads: { artifact: { path: any } } }) =>
                path.join(
                    basepath,
                    '.minecraft',
                    'libraries',
                    lib.downloads.artifact.path,
                ),
            )
            .join(';');

        const args = [
            '-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump',
            `-Djava.library.path=${path.join(versionBasePath, 'natives')}`,
            '-Dminecraft.launcher.brand=minecraft-launcher',
            '-Dminecraft.launcher.version=2.19.10',
            `-Dminecraft.client.jar=${jarPath}`,
            '-cp',
            `${libraries};${jarPath};`,
            '-Xmx2G',
            '-XX:+UnlockExperimentalVMOptions',
            '-XX:+UseG1GC',
            '-XX:G1NewSizePercent=20',
            '-XX:G1ReservePercent=20',
            '-XX:MaxGCPauseMillis=50',
            '-XX:G1HeapRegionSize=32M',
            'net.minecraft.client.main.Main',
            '--username',
            authPlayerName,
            '--version',
            versionName,
            '--gameDir',
            gameDirectory,
            '--assetsDir',
            assetsRoot,
            '--assetIndex',
            versionName,
            '--uuid',
            authUuid,
            '--accessToken',
            authAccessToken,
            '--userType',
            userType,
            '--versionType',
            versionData.type,
            '--width',
            '1000',
            '--height',
            '600',
        ];

        const minecraftProcess = spawn(javaPath, args, {
            detached: true, // Spawn the process in detached mode
            stdio: 'ignore', // Ignore stdio streams (optional)
        });

        minecraftProcess.unref();

        app.quit();
    } catch (err) {
        log('Error launching Minecraft:', err);
    }
}

ipcMain.handle('mcLaunch', async (event, args) => {
    const { profileId, profiles, versions } = args;

    log(`Launching profile ${profileId}`);

    const profile = profiles.find(
        (profileData: any) => profileData.id === profileId,
    );

    const version = versions.versions.find(
        (ver: any) => ver.id === profile.version,
    );

    log(`Launching profile ${profile.name} with version ${version.id}`);

    const versionData: any = await fetchGET(version.url);
    downloadMinecraftVersion(versionData);
});
