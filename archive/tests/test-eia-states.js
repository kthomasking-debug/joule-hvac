const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
const apiKey = process.env.VITE_EIA_API_KEY;

async function testAllStates() {
  const results = [];
  
  console.log('Testing EIA natural gas price data for all states...\n');
  
  for (const state of states) {
    const url = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[process][]=PRS&facets[duoarea][]=${state}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      const hasData = data?.response?.data?.length > 0;
      const value = hasData ? data.response.data[0].value : null;
      const period = hasData ? data.response.data[0].period : null;
      
      results.push({ state, hasData, value, period });
      
      // Show progress
      process.stdout.write('.');
    } catch (e) {
      results.push({ state, hasData: false, error: e.message });
      process.stdout.write('x');
    }
  }
  
  console.log('\n\n=== RESULTS ===\n');
  
  const withData = results.filter(r => r.hasData);
  const withoutData = results.filter(r => !r.hasData);
  
  console.log(`States WITH data (${withData.length}):`);
  withData.forEach(r => {
    const pricePerTherm = r.value / 10.37;
    console.log(`  ${r.state}: $${r.value.toFixed(2)}/Mcf → $${pricePerTherm.toFixed(3)}/therm (${r.period})`);
  });
  
  console.log(`\nStates WITHOUT data (${withoutData.length}):`);
  withoutData.forEach(r => console.log(`  ${r.state}`));
}

testAllStates().catch(console.error);
