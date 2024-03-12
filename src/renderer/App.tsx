import { useEffect, useState } from 'react';
import { MemoryRouter as Router, Routes, Route, Link } from 'react-router-dom';
import icon from '../../assets/images/Grass_Block.png';
import './App.css';
import Settings from './pages/Settings';
import ProfileEditor from './pages/ProfileEditor';

declare global {
    interface Window {
        api: any;
    }
}

function Home({
    profiles,
    currentProfile,
    downloadProgress,
    launchState,
    play,
    updateCurrentProfile,
}: any) {
    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
            }}
        >
            <img
                width="85px"
                height="85px"
                alt="icon"
                src={icon}
                style={{ marginBottom: '20px' }}
            />

            {profiles.length > 0 && (
                <button
                    type="button"
                    className="btn playBtn"
                    onClick={play}
                    disabled={launchState !== 'none'}
                >
                    Play
                </button>
            )}

            {/* download progress bar */}

            {launchState !== 'none' && (
                <div className="progress">
                    <div
                        className="progress-bar progress-bar-striped progress-bar-animated"
                        style={{ width: `${downloadProgress}%` }}
                    />
                    <p className="progress-text">
                        {Math.round(downloadProgress)}%
                    </p>
                </div>
            )}

            <select
                className="select form-control"
                onChange={(e) => {
                    updateCurrentProfile(e.target.value);
                }}
                value={currentProfile}
            >
                {profiles.map((profile: any) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name} - {profile.version}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function App() {
    const [profiles, setProfiles] = useState([]);
    const [currentProfile, setCurrentProfile] = useState(0);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [launchState, setLaunchState] = useState('none');

    useEffect(() => {
        window.api
            .invoke('readProfiles')
            .then((result: any) => {
                setCurrentProfile(result.currentProfile);
                setProfiles(result.profiles);
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching profiles:', error);
            });
    }, []);

    useEffect(() => {
        window.api.on('mcLaunchState', (state: any) => {
            setLaunchState(state);
            console.log(state);
        });
    }, []);

    useEffect(() => {
        window.api.on('downloadProgress', (result: any) => {
            setDownloadProgress(result);
            return true;
        });
    }, []);

    const updateCurrentProfile = (id: any) => {
        // convert id to number
        const idint = parseInt(id, 10);
        setCurrentProfile(idint);
        window.api
            .invoke('updateCurrentProfile', idint)
            .then(() => {
                return true;
            })
            .catch((error: any) => {
                console.error('Error updating current profile:', error);
            });
    };

    const play = () => {
        setLaunchState('launching');
        window.api
            .invoke('readVersions')
            .then((versions: any) => {
                window.api
                    .invoke('mcLaunch', {
                        profileId: currentProfile,
                        profiles,
                        versions,
                    })
                    .then(() => {
                        return true;
                    })
                    .catch((error: any) => {
                        console.error('Error launching Minecraft:', error);
                    });
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching versions:', error);
            });
    };

    return (
        <Router>
            <div className="App">
                <div className="sidebar">
                    <div className="icon">
                        <img width="100%" height="100%" alt="icon" src={icon} />
                    </div>
                    <div className="title">nCraft</div>
                    <div className="menu">
                        <Link to="/">Home</Link>
                        <Link to="/settings">Settings</Link>
                    </div>
                </div>
                <div className="page">
                    <div className="content">
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <Home
                                        profiles={profiles}
                                        currentProfile={currentProfile}
                                        downloadProgress={downloadProgress}
                                        launchState={launchState}
                                        updateCurrentProfile={
                                            updateCurrentProfile
                                        }
                                        play={play}
                                    />
                                }
                            />
                            <Route path="/settings" element={<Settings />} />
                            <Route
                                path="/profile/:id"
                                element={<ProfileEditor />}
                            />
                        </Routes>
                    </div>
                </div>
            </div>
        </Router>
    );
}
