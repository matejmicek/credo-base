import { task } from "@trigger.dev/sdk/v3";

export const fetchPersonDetails = task({
  id: "fetch-person-details",
  run: async (payload: { personId: number }) => {
    console.log("🔍 Fetching person details for ID:", payload.personId);
    
    const leadspickerUrl = `https://app.leadspicker.com/app/sb/api/persons/${payload.personId}`;
    const apiKey = process.env.LEADSPICKER_API_KEY;
    
    if (!apiKey) {
      throw new Error("LEADSPICKER_API_KEY environment variable is not set");
    }
    
    console.log("📡 API URL:", leadspickerUrl);
    
    try {
      const response = await fetch(leadspickerUrl, {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-API-Key": apiKey
        }
      });
      
      console.log("📊 API Response Status:", response.status);
      console.log("📋 API Response Headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
        console.error("❌ API Error:", errorMessage);
        throw new Error(errorMessage);
      }
      
      const personDetails = await response.json();
      
      console.log('\n████████████████████████████████████████████████████████████████████████████████');
      console.log('██                                                                              ██');
      console.log('██                        FULL PERSON DETAILS                                  ██');
      console.log('██                                                                              ██');
      console.log('████████████████████████████████████████████████████████████████████████████████');
      console.log('\n--- PERSON DETAILS RESPONSE ---');
      console.log('Response type:', typeof personDetails);
      console.log('Full response:', JSON.stringify(personDetails, null, 2));
      
      if (personDetails && typeof personDetails === 'object') {
        console.log('\n--- PERSON DETAILS BREAKDOWN ---');
        const detailKeys = Object.keys(personDetails);
        console.log('Number of properties:', detailKeys.length);
        console.log('Property names:', detailKeys);
        
        detailKeys.forEach(key => {
          const value = personDetails[key];
          console.log(`\n🔹 ${key.toUpperCase()}:`);
          console.log('   Type:', typeof value);
          
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              console.log('   Array length:', value.length);
              console.log('   Array items:', JSON.stringify(value, null, 4));
            } else {
              console.log('   Object keys:', Object.keys(value));
              console.log('   Object:', JSON.stringify(value, null, 4));
            }
          } else {
            console.log('   Value:', value);
          }
        });
      }
      
      console.log('\n████████████████████████████████████████████████████████████████████████████████');
      console.log('██                                                                              ██');
      console.log('██                      END PERSON DETAILS                                     ██');
      console.log('██                                                                              ██');
      console.log('████████████████████████████████████████████████████████████████████████████████\n');
      
      console.log("✅ Person details fetched successfully");
      
      return personDetails;
      
    } catch (error) {
      console.error("❌ Failed to fetch person details:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      // Re-throw the error so the orchestrator can handle it
      throw error;
    }
  },
});
