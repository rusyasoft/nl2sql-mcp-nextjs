import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// Initialize Gemini API using the API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not found in environment variables. The nl-to-sql tool will not work properly.');
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Load database schemas from files
async function loadDatabaseSchemas() {
  const schemasDir = join(process.cwd(), 'app', 'schemas');
  try {
    const schemaFiles = await fs.readdir(schemasDir);
    const schemas: Record<string, string> = {};
    
    for (const file of schemaFiles) {
      if (file.endsWith('.sql')) {
        const tableName = file.replace('.sql', '');
        const filePath = join(schemasDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        schemas[tableName] = content;
      }
    }
    
    return schemas;
  } catch (error) {
    console.error('Error loading database schemas:', error);
    return {};
  }
}

// Store loaded schemas
let databaseSchemas: Record<string, string> = {};

// Load schemas before handling requests
loadDatabaseSchemas().then(schemas => {
  databaseSchemas = schemas;
  console.log(`Loaded ${Object.keys(schemas).length} database schema(s):`, Object.keys(schemas));
}).catch(error => {
  console.error('Error loading database schemas:', error);
});

// Helper for date formatting
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return format
    .replace(/YYYY/g, year)
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds);
}

const handler = createMcpHandler(
  (server) => {
    // Keep the existing echo tool
    server.tool(
      "echo",
      "Echo a message",
      { message: z.string() },
      async ({ message }) => ({
        content: [{ type: "text", text: `Tool echo: ${message}` }],
      })
    );

    // Add the calculate tool
    server.tool(
      "calculate",
      "Calculate a mathematical expression",
      { expression: z.string().describe("The mathematical expression to evaluate") },
      async ({ expression }) => {
        try {
          // Simple evaluation - in production you'd want to use a safer method
          const result = eval(expression.replace(/[^-()*+/0-9.]/g, ''));
          return {
            content: [{ type: "text", text: `Result: ${result}` }]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error: Could not evaluate expression '${expression}'` }]
          };
        }
      }
    );
    
    // Add the convert tool
    server.tool(
      "convert",
      "Convert between different units",
      { 
        value: z.number().describe("The value to convert"),
        fromUnit: z.string().describe("The unit to convert from"),
        toUnit: z.string().describe("The unit to convert to")
      },
      async ({ value, fromUnit, toUnit }) => {
        // Unit conversion implementations
        const conversions: Record<string, Record<string, (val: number) => number>> = {
          "celsius": { "fahrenheit": (c: number) => c * 9/5 + 32 },
          "fahrenheit": { "celsius": (f: number) => (f - 32) * 5/9 },
          "kilometers": { "miles": (km: number) => km * 0.621371 },
          "miles": { "kilometers": (mi: number) => mi * 1.60934 },
          "kilograms": { "pounds": (kg: number) => kg * 2.20462 },
          "pounds": { "kilograms": (lb: number) => lb * 0.453592 }
        };
        
        try {
          if (conversions[fromUnit] && conversions[fromUnit][toUnit]) {
            const result = conversions[fromUnit][toUnit](value);
            const formatted = Number(result).toFixed(4);
            return {
              content: [{ type: "text", text: `${value} ${fromUnit} = ${formatted} ${toUnit}` }]
            };
          }
          return {
            content: [{ type: "text", text: `Error: Conversion from ${fromUnit} to ${toUnit} is not supported.` }]
          };
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Error during conversion: ${errorMessage}` }]
          };
        }
      }
    );
    
    // Add the format-date tool
    server.tool(
      "format-date",
      "Format a date according to a specified pattern",
      { 
        date: z.string().optional().describe("Date string to format (defaults to current date)"),
        format: z.string().optional().describe("Format string (e.g., 'YYYY-MM-DD')")
      },
      async ({ date, format }) => {
        try {
          const inputDate = date ? new Date(date) : new Date();
          const formattedDate = format ? formatDate(inputDate, format) : inputDate.toISOString();
          return {
            content: [{ type: "text", text: formattedDate }]
          };
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Error formatting date: ${errorMessage}` }]
          };
        }
      }
    );
    
    // Add the nl-to-sql tool with database schemas
    server.tool(
      "nl-to-sql",
      "Convert natural language to SQL using database schemas",
      {
        query: z.string().describe(
          "Convert natural language to SQL for our HR database. " +
          "Available tables: employees (with personal details, salary, department_id, manager_id), " +
          "departments (id, name, location, budget), " +
          "projects (id, name, dates, status, budget), " +
          "employee_projects (assignments of employees to projects). " +
          "Examples: 'Find employees in IT earning over 70k', 'List projects ending this year', 'Show managers with most direct reports'"
        )
      },
      async ({ query }) => {
        try {
          if (!GEMINI_API_KEY) {
            return {
              content: [{ type: "text", text: "Error: GEMINI_API_KEY is not set in environment variables. The nl-to-sql tool cannot function without it." }]
            };
          }
          
          if (Object.keys(databaseSchemas).length === 0) {
            return {
              content: [{ type: "text", text: "Error: Database schemas not loaded. Please ensure SQL schema files exist in the app/schemas directory." }]
            };
          }
          
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          
          // Prepare the prompt with schema information and the query
          let promptText = "You are a SQL expert that converts natural language queries to precise SQL. ";
          promptText += "Based on the following database schema:\n\n";
          
          // Add each schema definition to the prompt
          Object.entries(databaseSchemas).forEach(([tableName, ddl]) => {
            promptText += `Table: ${tableName}\n${ddl}\n\n`;
          });
          
          // Add the natural language query
          promptText += `Convert this natural language query to valid SQL:\n"${query}"\n\n`;
          promptText += "Respond only with the SQL query, no explanation or other text.";
          
          // Generate content using Gemini
          const result = await model.generateContent(promptText);
          const response = await result.response;
          const sqlQuery = response.text().trim();
          
          return {
            content: [
              { type: "text", text: sqlQuery },
              { type: "text", text: "\n\nGenerated from natural language query: " + query }
            ]
          };
        } catch (error: any) {
          console.error("Error in nl-to-sql tool:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: `Error generating SQL from natural language: ${errorMessage}` }]
          };
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
        calculate: {
          description: "Calculate a mathematical expression",
        },
        convert: {
          description: "Convert between different units",
        },
        "format-date": {
          description: "Format a date according to a specified pattern",
        },
        "nl-to-sql": {
          description: "Convert natural language to SQL",
        },
      },
    },
  }
);

export { handler as GET, handler as POST, handler as DELETE };
