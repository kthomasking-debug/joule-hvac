// Test script to verify Groq API key and check available models
// Replace with your own Groq API key from https://console.groq.com/
const API_KEY = "YOUR_GROQ_API_KEY_HERE";

async function testGroqAPI() {
  console.log("Testing Groq API...\n");

  try {
    // 1. Fetch available models
    console.log("1. Fetching available models...");
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "❌ Failed to fetch models:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Error details:", errorText);
      return;
    }

    const data = await response.json();
    const models = data?.data || [];

    console.log(`✅ Found ${models.length} available models:\n`);
    models.forEach((model, idx) => {
      console.log(`   ${idx + 1}. ${model.id}`);
      if (model.owned_by) console.log(`      Owner: ${model.owned_by}`);
    });

    // 2. Test a simple completion with the first available model
    if (models.length > 0) {
      const testModel = models[0].id;
      console.log(`\n2. Testing completion with model: ${testModel}`);

      const completionResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: testModel,
            messages: [
              {
                role: "user",
                content: 'Say "Hello from Groq!" in exactly 5 words.',
              },
            ],
            max_tokens: 50,
          }),
        }
      );

      if (!completionResponse.ok) {
        console.error(
          "❌ Completion failed:",
          completionResponse.status,
          completionResponse.statusText
        );
        const errorText = await completionResponse.text();
        console.error("Error details:", errorText);
        return;
      }

      const completionData = await completionResponse.json();
      const message = completionData?.choices?.[0]?.message?.content;

      console.log("✅ API Response:", message);
      console.log("\n✨ Groq API is working correctly!");
    }
  } catch (error) {
    console.error("❌ Error testing Groq API:", error);
  }
}

testGroqAPI();
