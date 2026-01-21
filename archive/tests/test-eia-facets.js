const apiKey = process.env.VITE_EIA_API_KEY;

async function exploreFacets() {
  // First, let's see what facets are available
  const facetsUrl = `https://api.eia.gov/v2/natural-gas/pri/sum/facets/?api_key=${apiKey}`;
  
  console.log('Getting available facets...\n');
  const facetsResp = await fetch(facetsUrl);
  const facetsData = await facetsResp.json();
  console.log('Available facets:');
  console.log(JSON.stringify(facetsData, null, 2));
  
  console.log('\n\n===================\n');
  
  // Try getting some data for any state without filtering by process
  const dataUrl = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[duoarea][]=SGA&sort[0][column]=period&sort[0][direction]=desc&length=5`;
  
  console.log('Trying SGA (South Georgia) data...\n');
  const dataResp = await fetch(dataUrl);
  const data = await dataResp.json();
  console.log('Response:');
  console.log(JSON.stringify(data, null, 2));
}

exploreFacets().catch(console.error);
