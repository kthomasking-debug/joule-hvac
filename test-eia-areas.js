const apiKey = process.env.VITE_EIA_API_KEY;

async function getAllStateAreas() {
  // Get all available duoarea values
  const url = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[process][]=PRS&sort[0][column]=period&sort[0][direction]=desc&length=100`;
  
  console.log('Getting state area codes from EIA...\n');
  const resp = await fetch(url);
  const data = await resp.json();
  
  // Extract unique duoarea values
  const areas = new Set();
  data.response.data.forEach(item => {
    if (item.duoarea) areas.add(item.duoarea);
  });
  
  const sortedAreas = Array.from(areas).sort();
  console.log('Available duoarea codes:');
  sortedAreas.forEach(area => {
    const sample = data.response.data.find(d => d.duoarea === area);
    console.log(`  ${area}: ${sample['area-name']} - ${sample.value ? '$' + sample.value + '/MCF' : 'no data'} (${sample.period})`);
  });
}

getAllStateAreas().catch(console.error);
