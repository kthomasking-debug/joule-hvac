import fetch from 'node-fetch';

const testLocations = async () => {
    const locations = ['New York, New York', 'Atlanta, GA'];
    for (const location of locations) {
        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
            console.log(`Testing location: ${location}`);
            console.log(`Response status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Full response data for ${location}:`, JSON.stringify(data, null, 2));
            } else {
                console.error(`Failed to fetch data for ${location}`);
            }
        } catch (error) {
            console.error(`Error testing location ${location}:`, error.message);
        }
    }
};

testLocations();