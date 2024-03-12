import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// declare that the id is a number

export default function ProfileEditor() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [profile, setProfile] = useState<{
        name: string;
        version: string;
    } | null>(null);
    const [versions, setVersions] = useState<{ id: string }[]>([]);
    const [version, setVersion] = useState('');
    const [name, setName] = useState('');

    useEffect(() => {
        // Fetch profile when component mounts
        window.api
            .invoke('readProfile', id)
            .then((result: any) => {
                setProfile(result);
                setName(result.name);
                setVersion(result.version);
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching profile:', error);
            });

        // Fetch versions when component mounts
        window.api
            .invoke('readVersions')
            .then((result: any) => {
                console.log(result);
                setVersions(result.versions); // Add a return statement here
                return true;
            })
            .catch((error: any) => {
                console.error('Error fetching versions:', error);
            });
    }, [id]);

    const updateProfile = () => {
        if (!id) {
            return;
        }
        window.api
            .invoke('readProfiles')
            .then((result: any) => {
                const currentProfile = result.profiles.find(
                    (p: any) => parseInt(p.id, 10) === parseInt(id, 10),
                );

                if (!currentProfile) {
                    throw new Error('Current profile not found');
                }

                currentProfile.name = name;
                currentProfile.version = version;

                result.profiles = result.profiles.map((p: any) => {
                    if (parseInt(p.id, 10) === parseInt(id, 10)) {
                        return currentProfile;
                    }
                    return p;
                });

                console.log(result);

                window.api.invoke('writeProfiles', {
                    profiles: result,
                });
                navigate('/settings');
                return true;
            })
            .catch((error: any) => {
                console.error('Error updating profile:', error);
                throw error;
            });
    };

    const deleteProfile = () => {
        if (!id) {
            return;
        }
        window.api
            .invoke('readProfiles')
            .then((result: any) => {
                const currentProfile = result.profiles.find(
                    (p: any) => parseInt(p.id, 10) === parseInt(id, 10),
                );

                if (!currentProfile) {
                    throw new Error('Current profile not found');
                }

                result.profiles = result.profiles.filter(
                    (p: any) => parseInt(p.id, 10) !== parseInt(id, 10),
                );

                window.api.invoke('writeProfiles', {
                    profiles: result,
                });
                navigate('/settings');
                return true;
            })
            .catch((error: any) => {
                console.error('Error deleting profile:', error);
                throw error;
            });
    };

    useEffect(() => {}, []);

    return (
        <div>
            {profile && versions ? (
                <>
                    <p style={{ fontSize: '2em' }}>{profile.name}</p>
                    <div>
                        <button
                            type="button"
                            className="btn"
                            onClick={deleteProfile}
                        >
                            Delete Profile
                        </button>
                        <div
                            className="form-group"
                            style={{ marginTop: '10px', position: 'relative' }}
                        >
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label htmlFor="name">Name</label>
                            <input
                                className="form-control"
                                id="name"
                                type="text"
                                onChange={(e) => setName(e.target.value)}
                                value={name}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div
                            className="form-group"
                            style={{ marginTop: '5px', position: 'relative' }}
                        >
                            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                            <label htmlFor="version">Version</label>
                            <select
                                className="form-control"
                                id="version"
                                onChange={(e) => setVersion(e.target.value)}
                                value={version}
                                style={{ width: '100%' }}
                            >
                                {versions.map((ver) => (
                                    <option key={ver.id} value={ver.id}>
                                        {ver.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            className="btn"
                            style={{
                                width: 'fit-content',
                                display: 'block',
                                margin: '10px auto',
                            }}
                            onClick={updateProfile}
                        >
                            Save
                        </button>
                    </div>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
}
