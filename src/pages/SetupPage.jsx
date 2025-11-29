import React, { useState } from 'react';

const SetupPage = ({ onSetupComplete }) => {
    const [location, setLocation] = useState({ city: '', state: '' });
    const [apiKeys, setApiKeys] = useState({ nrel: '', eia: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validate inputs
        if (!location.city) {
            alert('Please enter a city.');
            return;
        }
        // Pass data back to parent or save it
        onSetupComplete({ location, apiKeys });
    };

    return (
        <div className="setup-page p-6 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-4">Setup Your Forecast</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Location</label>
                    <input
                        type="text"
                        value={`${location.city}${location.state ? ', ' + location.state : ''}`}
                        onChange={(e) => {
                            const [city, state] = e.target.value.split(',').map((s) => s.trim());
                            setLocation({ city, state: state || '' });
                        }}
                        placeholder="Enter city, state (optional)"
                        className="p-2 border rounded-lg w-full"
                    />
                </div>

                <details className="bg-gray-100 p-4 rounded-lg">
                    <summary className="font-bold text-blue-600 cursor-pointer">Advanced: API Keys</summary>
                    <div className="mt-2">
                        <label className="block text-sm font-medium">NREL API Key</label>
                        <input
                            type="password"
                            value={apiKeys.nrel}
                            onChange={(e) => setApiKeys({ ...apiKeys, nrel: e.target.value })}
                            placeholder="Enter your NREL API key"
                            className="p-2 border rounded-lg w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Get a free key from the <a href="https://developer.nrel.gov/signup/" target="_blank" className="text-blue-500 underline">NREL Developer Network</a>.
                        </p>

                        <label className="block text-sm font-medium mt-4">EIA API Key</label>
                        <input
                            type="password"
                            value={apiKeys.eia}
                            onChange={(e) => setApiKeys({ ...apiKeys, eia: e.target.value })}
                            placeholder="Enter your EIA API key"
                            className="p-2 border rounded-lg w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Get a free key from the <a href="https://www.eia.gov/opendata/register.php" target="_blank" className="text-blue-500 underline">EIA Open Data portal</a>.
                        </p>
                    </div>
                </details>
                <button type="submit" className="btn btn-primary w-full">Save and Continue</button>
            </form>
        </div>
    );
};

export default SetupPage;