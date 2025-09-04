import { task } from "@trigger.dev/sdk/v3";
import { fetchPersonDetails } from "./fetchPersonDetails";

export const addPersonOrchestrator = task({
  id: "add-person-orchestrator",
  run: async (payload: { personId: number }) => {
    console.log("🚀 Starting person orchestration for ID:", payload.personId);
    
    try {
      // Step 1: Fetch detailed person information from Leadspicker
      console.log("📡 Fetching person details from Leadspicker API...");
      const personDetails = await fetchPersonDetails.trigger({ 
        personId: payload.personId 
      });
      
      console.log("✅ Person details fetched successfully");
      console.log("Person details keys:", Object.keys(personDetails || {}));
      
      // TODO: Add more orchestration steps here as needed:
      // - Save to database
      // - Send notifications
      // - Update CRM
      // - Generate reports
      // etc.
      
      return {
        success: true,
        personId: payload.personId,
        personDetails,
        steps: [
          { step: "fetch_person_details", status: "completed", timestamp: new Date().toISOString() }
        ],
        message: "Person orchestration completed successfully"
      };
      
    } catch (error) {
      console.error("❌ Error in person orchestration:", error);
      
      return {
        success: false,
        personId: payload.personId,
        error: error instanceof Error ? error.message : "Unknown error",
        steps: [
          { step: "fetch_person_details", status: "failed", timestamp: new Date().toISOString() }
        ],
        message: "Person orchestration failed"
      };
    }
  },
});
