import { task } from "@trigger.dev/sdk/v3";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

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
      
      // Save person to database
      console.log("💾 Saving person to database...");
      try {
        const savedPerson = await prisma.person.create({
          data: {
            leadspickerId: personDetails.id,
            fullName: personDetails.contact_data?.full_name?.value || null,
            firstName: personDetails.contact_data?.first_name?.value || null,
            lastName: personDetails.contact_data?.last_name?.value || null,
            email: personDetails.contact_data?.email?.value || null,
            position: personDetails.contact_data?.position?.value || null,
            linkedinUrl: personDetails.contact_data?.linkedin?.value || null,
            followersCount: personDetails.contact_data?.followers_count?.value ? 
              parseInt(personDetails.contact_data.followers_count.value) : null,
            companyName: personDetails.contact_data?.company_name?.value || null,
            companyLinkedinUrl: personDetails.contact_data?.company_linkedin?.value || null,
            companyWebsiteUrl: personDetails.contact_data?.company_website?.value || null,
            companyEmployeeCount: personDetails.contact_data?.company_employee_count?.value ? 
              parseInt(personDetails.contact_data.company_employee_count.value) : null,
            companyDescription: personDetails.contact_data?.linkedin_company_description?.value || null,
            websiteTextSummary: personDetails.contact_data?.website_text_summary?.value || null,
            pastExperiences: personDetails.contact_data?.past_experiences?.value || null,
            educationSummary: personDetails.contact_data?.education_summary?.value || null,
            country: personDetails.contact_data?.country?.value || null,
            sourceRobot: personDetails.contact_data?.source_robot?.value || null,
          }
        });
        
        console.log("✅ Person saved to database successfully");
        console.log("🆔 Database ID:", savedPerson.id);
        console.log("🔗 Leadspicker ID:", savedPerson.leadspickerId);
        console.log("👤 Name:", savedPerson.fullName);
        
        console.log("✅ Person details fetch and save completed successfully");
        return {
          personDetails,
          savedPerson: {
            id: savedPerson.id,
            leadspickerId: savedPerson.leadspickerId,
            fullName: savedPerson.fullName,
            companyName: savedPerson.companyName
          }
        };
        
      } catch (dbError) {
        console.error("❌ Failed to save person to database:", dbError);
        console.error("🔍 Database error type:", dbError instanceof Error ? dbError.constructor.name : typeof dbError);
        console.error("📚 Database error details:", dbError instanceof Error ? dbError.message : "Unknown error");
        
        // Still return the API data even if database save fails
        console.log("⚠️ Returning API data despite database save failure");
        return {
          personDetails,
          dbError: dbError instanceof Error ? dbError.message : "Unknown database error"
        };
      }
      
    } catch (error) {
      console.error("❌ Fatal error in person details fetch:", error);
      console.error("🔍 Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("📚 Error stack:", error instanceof Error ? error.stack : "No stack trace available");
      
      console.log("🔄 Re-throwing error for orchestrator handling...");
      throw error;
    } finally {
      // Clean up Prisma connection
      await prisma.$disconnect();
      console.log("🔌 Prisma client disconnected");
    }
  },
});
