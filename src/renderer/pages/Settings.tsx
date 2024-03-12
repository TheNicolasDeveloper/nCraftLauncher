import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Settings() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [versions, setVersions] = useState<{ id: string }[]>([]);

    useEffect(() => {
        window.api
            .invoke('readProfiles')
            .then((result: any) => {
                setProfiles(result.profiles); // Update the profiles state
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching profiles:', error);
            });

        window.api
            .invoke('readVersions')
            .then((result: any) => {
                setVersions(result.versions); // Update the versions state
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching versions:', error);
            });
    }, []); // Add an empty dependency array to trigger the effect only once

    const addProfile = () => {
        const currentProfiles = profiles;
        const newProfiles: any = [
            ...currentProfiles,
            {
                id: currentProfiles.length + 1,
                name: 'New Profile',
                version: versions[0].id,
            },
        ];

        window.api
            .invoke('writeProfiles', {
                profiles: {
                    currentProfile: currentProfiles.length + 1,
                    profiles: newProfiles,
                },
            })
            .then(() => {
                setProfiles(newProfiles); // Update the profiles state
                navigate(`/profile/${currentProfiles.length + 1}`);
                return true;
            })
            .catch((error: any) => {
                console.error('Error adding profile:', error);
            });
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                padding: '20px',
            }}
        >
            <h1>Settings</h1>
            <button className="btn" type="button" onClick={addProfile}>
                Add profile
            </button>
            <ul className="profiles">
                {profiles.map((profile: any) => (
                    <li key={profile.name}>
                        {profile.id > 2 && (
                            <Link
                                to={`/profile/${profile.id}`}
                                className="fullLink"
                            />
                        )}
                        {profile.name} - {profile.version}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Settings;
