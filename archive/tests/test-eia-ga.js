const apiKey = process.env.VITE_EIA_API_KEY;
const state = 'GA';

async function testGA() {
  const url = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[process][]=PRS&facets[duoarea][]=${state}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
  
  console.log('URL:', url);
  console.log('\n');
  
  try {
    const response = await fetch(url);
    console.log('Status:', response.status);
    
    const data = await response.json();
    console.log('\nFull Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testGA();
