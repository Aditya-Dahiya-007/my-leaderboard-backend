import fs from 'fs';
import csv from "csv-parser";
import path from 'path';
import { NextResponse } from 'next/server'; // Use NextResponse for convenience

// Define expected data structure for clarity
interface LeaderboardEntry {
    name: string;
    redemptionStatus: boolean;
    skillBadges: number;
    arcadePoints: number;
    progress: number;
    skillBadgesStr: string;
    arcadePointsStr: string;
    rank?: number; // Rank added after sorting
}

export async function GET() {
    // Correct path relative to the root of the deployed project
    const filePath = path.join(process.cwd(), 'abc.csv'); 

    const results: any[] = [];

    try {
        await new Promise<void>((resolve, reject) => {
            // Check if file exists before trying to read
            if (!fs.existsSync(filePath)) {
                return reject(new Error(`CSV file not found at path: ${filePath}`));
            }

            fs.createReadStream(filePath)
                .pipe(csv())
                .on("data", (row) => results.push(row))
                .on("end", () => resolve())
                .on("error", (err) => reject(err)); 
        });

        // Remove header row if present
        if (results.length > 0 && results[0]['User Name'] === 'User Name') {
             results.shift(); 
        }

        // Process data
        let processedData: LeaderboardEntry[] = results.map(item => {
            const skillBadges = parseInt(item["# of Skill Badges Completed"], 10) || 0;
            const arcadePoints = parseInt(item["# of Arcade Games Completed"], 10) || 0;
            // Handle variations in "Yes"/"No"
            const redemptionStatus = item['Access Code Redemption Status']?.trim().toLowerCase() === "yes"; 

            const total = skillBadges + arcadePoints;
            const maxCourses = 20; 
            let progress = Math.round((total / maxCourses) * 100);
            progress = Math.min(progress, 100); 

            return {
                name: item['User Name'] || "Unknown Name",
                redemptionStatus: redemptionStatus,
                skillBadges: skillBadges,
                arcadePoints: arcadePoints,
                progress: progress,
                skillBadgesStr: `${skillBadges}/19`, 
                arcadePointsStr: `${arcadePoints}/1`
            };
        });

        // Sort data
        processedData.sort((a, b) => {
            if (a.redemptionStatus !== b.redemptionStatus) {
                return a.redemptionStatus ? -1 : 1; 
            }
            if (b.skillBadges !== a.skillBadges) {
                return b.skillBadges - a.skillBadges;
            }
            if (b.arcadePoints !== a.arcadePoints) {
                return b.arcadePoints - a.arcadePoints;
            }
            return (a.name || "").localeCompare(b.name || ""); 
        });

        // Add rank
        const rankedData = processedData.map((student, index) => ({
            ...student,
            rank: index + 1
        }));

        // Get file update time
        const updatedAt = fs.statSync(filePath).mtime.toISOString();

        // Prepare successful response payload
        const responsePayload = {
            success: true,
            message: "Leaderboard data fetched successfully.",
            updatedAt: updatedAt,
            data: rankedData,
        };

        // Return successful response with CORS header
        return NextResponse.json(responsePayload, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow all origins
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });

    } catch (error: any) { 
        console.error("Error processing leaderboard API:", error); 
        
        // Return error response with CORS header
        return NextResponse.json({
            success: false,
            message: "Error reading leaderboard data.",
            error: error.message
        }, { 
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow all origins
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
         });
    }
}

// Optional: Add an OPTIONS handler for more complex CORS scenarios if needed
export async function OPTIONS() {
    return new Response(null, {
        status: 204, // No Content
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
