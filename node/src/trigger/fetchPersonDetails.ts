import { task } from "@trigger.dev/sdk/v3";

export const fetchPersonDetails = task({
  id: "fetch-person-details",
  run: async (payload: { personId: number }) => {
    console.log("🚀 Starting person details fetch for ID:", payload.personId);
    
    console.log("🔧 Setting up API configuration...");
    const leadspickerUrl = `https://app.leadspicker.com/app/sb/api/persons/${payload.personId}`;
    const apiKey = process.env.LEADSPICKER_API_KEY;
    
    if (!apiKey) {
      console.error("❌ Missing API key configuration");
      throw new Error("LEADSPICKER_API_KEY environment variable is not set");
    }
    
    console.log("✅ API configuration ready");
    console.log("📡 Target URL:", leadspickerUrl);
    
    try {
      console.log("📤 Sending API request to Leadspicker...");
      const response = await fetch(leadspickerUrl, {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-API-Key": apiKey
        }
      });
      
      console.log("📥 Received API response");
      console.log("📊 Response status:", response.status);
      console.log("📋 Response headers:", Object.fromEntries(response.headers as any));
      
      if (!response.ok) {
        console.error("❌ API request failed with status:", response.status);
        const errorText = await response.text();
        const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
        console.error("💥 Error details:", errorText);
        throw new Error(errorMessage);
      }
      
      console.log("✅ API request successful, parsing JSON...");
      const personDetails = await response.json();
      
      console.log("🎉 Person details successfully parsed");
      console.log("📝 Response contains keys:", Object.keys(personDetails || {}));
      console.log("📏 Response data size:", JSON.stringify(personDetails).length, "characters");
      
      console.log('\n--- 📋 PERSON DETAILS RESPONSE ---');
      console.log('Full response:', JSON.stringify(personDetails, null, 2));
      console.log('--- 📋 END RESPONSE ---\n');
      
      console.log("✅ Person details fetch completed successfully");
      return personDetails;
      
    } catch (error) {
      console.error("❌ Fatal error in person details fetch:", error);
      console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("📚 Error stack:", error instanceof Error ? error.stack : "No stack trace available");
      
      console.log("🔄 Re-throwing error for orchestrator handling...");
      throw error;
    }
  },
});
