import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL]
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 8080;

// Environment variables
const LLM_BASE_URL =
  process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const LLM_API_KEY = process.env.LLM_API_KEY;

console.log("🔧 Server starting...");
console.log("Environment variables:");
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- PORT:", process.env.PORT);
console.log("- LLM_API_KEY configured:", !!LLM_API_KEY);
console.log("- LLM_API_KEY length:", LLM_API_KEY?.length || 0);
console.log("- LLM_BASE_URL:", LLM_BASE_URL);

if (!LLM_API_KEY) {
  console.warn("⚠️  LLM_API_KEY not set. Chat functionality will not work.");
}

app.use(
  cors({
    origin: [
      "http://localhost:5173", // Vite dev server (default)
      "http://localhost:5174", // Vite dev server (alternate port)
      "http://localhost:3000",
      "https://pathweaver-storytelling-0cc048134931.herokuapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// LLM Configuration
const LLM_CONFIG = {
  temperature: 0.8,
  top_p: 0.9,
  max_tokens: 2048,
};

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Handle chat requests via WebSocket
  socket.on("chat_request", async (data) => {
    try {
      if (!LLM_API_KEY) {
        socket.emit("chat_error", {
          error: "API key not configured",
          details: "LLM_API_KEY environment variable is not set",
        });
        return;
      }

      const { messages, model, tools = [] } = data;

      // Always use the most reliable model for tool usage
      const groqModel = "llama-3.3-70b-versatile";

      console.log("Received WebSocket chat request:", {
        messagesCount: messages.length,
        toolCount: tools.length,
        requestedModel: model,
        usingModel: groqModel,
      });

      // Clean messages to only include role and content (Groq doesn't support id/timestamp)
      const cleanMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const requestBody = {
        model: groqModel,
        messages: cleanMessages,
        ...LLM_CONFIG,
      };

      // Add tools to request if provided
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = "required";
      }

      console.log("Sending to Groq:", JSON.stringify(requestBody, null, 2));

      // Disable TLS verification for local development only
      if (process.env.NODE_ENV !== "production") {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error response:", response.status, errorText);

        // Handle rate limiting with smart retry
        if (response.status === 429) {
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: { message: errorText } };
          }

          // Parse retry time from error message
          const retryMatch = errorData.error?.message?.match(
            /try again in (\d+)m(\d+(?:\.\d+)?)s/
          );
          let retryAfterSeconds = 60; // Default to 60 seconds if we can't parse

          if (retryMatch) {
            const minutes = parseInt(retryMatch[1]);
            const seconds = parseFloat(retryMatch[2]);
            retryAfterSeconds = minutes * 60 + seconds;
          }

          // Emit rate limit info to client
          socket.emit("rate_limit", {
            retryAfter: retryAfterSeconds,
            message: errorData.error?.message,
            limit: errorData.error?.message?.match(/Limit (\d+)/)?.[1],
            used: errorData.error?.message?.match(/Used (\d+)/)?.[1],
            requested: errorData.error?.message?.match(/Requested (\d+)/)?.[1],
          });

          console.log(
            `Rate limited. Retrying in ${retryAfterSeconds} seconds...`
          );

          // Wait and retry automatically
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfterSeconds * 1000)
          );

          console.log("Retrying request after rate limit wait...");

          // Retry the request
          const retryResponse = await fetch(
            `${LLM_BASE_URL}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLM_API_KEY}`,
              },
              body: JSON.stringify(requestBody),
            }
          );

          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            console.error(
              "Retry failed:",
              retryResponse.status,
              retryErrorText
            );
            throw new Error(
              `Retry failed: ${retryResponse.status} ${retryResponse.statusText} - ${retryErrorText}`
            );
          }

          // Use retry response instead
          const retryData = await retryResponse.json();
          socket.emit("retry_success", {
            message: "Request succeeded after rate limit wait",
          });

          // Continue with normal flow using retry response
          const aiMessage = retryData.choices[0].message;
          console.log("Retry successful, processing response...");

          // Process the successful retry response
          const toolResponses = [];

          if (aiMessage.tool_calls) {
            console.log("Tool calls:", JSON.stringify(aiMessage.tool_calls));
            for (const toolCall of aiMessage.tool_calls) {
              if (toolCall.function.name === "update_dynamic_component") {
                console.log(
                  "Handling dynamic component update:",
                  JSON.stringify(toolCall)
                );

                try {
                  let args;
                  try {
                    args = JSON.parse(toolCall.function.arguments);
                  } catch (parseError) {
                    console.log(
                      "Initial JSON parse failed, attempting to repair:",
                      parseError.message
                    );
                    let repairedArgs = toolCall.function.arguments
                      .replace(/\\'/g, "'")
                      .replace(/\n/g, "\\n")
                      .replace(/\\\\n/g, "\\n");

                    try {
                      args = JSON.parse(repairedArgs);
                      console.log("JSON repair successful");
                    } catch (repairError) {
                      console.error("JSON repair failed:", repairError.message);
                      socket.emit("chat_error", {
                        error: "Tool use failed due to JSON formatting",
                        details: `The generated JSX code contains characters that break JSON encoding. Please simplify the component and avoid complex text with quotes or special characters. Error: ${repairError.message}`,
                        retry: true,
                      });
                      return;
                    }
                  }

                  console.log("Emitting dynamic component update:", args);
                  socket.emit("dynamic_component_update", {
                    code: args.code,
                    toolCallId: toolCall.id,
                  });

                  toolResponses.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content:
                      "Dynamic component successfully created and rendered",
                  });
                } catch (parseError) {
                  console.error("Error parsing dynamic component:", parseError);
                }
              }
            }
          }

          if (toolResponses.length > 0) {
            console.log(
              "Making follow-up call to LLM with tool responses:",
              toolResponses
            );

            const followUpMessages = [
              ...cleanMessages,
              {
                role: "assistant",
                content: aiMessage.content || "",
                tool_calls: aiMessage.tool_calls,
              },
              ...toolResponses,
            ];

            const followUpRequestBody = {
              model: groqModel,
              messages: followUpMessages,
              ...LLM_CONFIG,
            };

            const followUpResponse = await fetch(
              `${LLM_BASE_URL}/chat/completions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${LLM_API_KEY}`,
                },
                body: JSON.stringify(followUpRequestBody),
              }
            );

            if (!followUpResponse.ok) {
              const errorText = await followUpResponse.text();
              console.error(
                "Groq follow-up API error:",
                followUpResponse.status,
                errorText
              );
              throw new Error(
                `Follow-up API error: ${followUpResponse.status} ${followUpResponse.statusText} - ${errorText}`
              );
            }

            const followUpData = await followUpResponse.json();
            const finalMessage = followUpData.choices[0].message;

            socket.emit("chat_response", {
              content: finalMessage.content || "",
              tool_calls: [],
            });
          } else {
            socket.emit("chat_response", {
              content: aiMessage.content || "",
              tool_calls: aiMessage.tool_calls || [],
            });
          }
          return; // Exit after successful retry
        }

        throw new Error(
          `API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const responseData = await response.json();
      const aiMessage = responseData.choices[0].message;

      console.log("Groq response:", {
        content: aiMessage.content,
        toolCalls: aiMessage.tool_calls,
      });

      // Handle dynamic component tool calls and prepare tool responses
      const toolResponses = [];

      if (aiMessage.tool_calls) {
        console.log("Tool calls:", JSON.stringify(aiMessage.tool_calls));
        for (const toolCall of aiMessage.tool_calls) {
          if (toolCall.function.name === "update_dynamic_component") {
            console.log(
              "Handling dynamic component update:",
              JSON.stringify(toolCall)
            );

            try {
              let args;
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (parseError) {
                console.log(
                  "Initial JSON parse failed, attempting to repair:",
                  parseError.message
                );
                console.log(
                  "Original args preview:",
                  toolCall.function.arguments.substring(0, 100) + "..."
                );

                // More targeted JSON repair - fix escaped quotes and newlines
                let repairedArgs = toolCall.function.arguments
                  // Fix incorrectly escaped single quotes that should be literal
                  .replace(/\\'/g, "'")
                  // Ensure newlines in the code string are properly escaped
                  .replace(/\n/g, "\\n")
                  // Fix any remaining double-escaped newlines
                  .replace(/\\\\n/g, "\\n");

                console.log(
                  "Repaired args preview:",
                  repairedArgs.substring(0, 100) + "..."
                );

                try {
                  args = JSON.parse(repairedArgs);
                  console.log("JSON repair successful");
                } catch (repairError) {
                  console.error("JSON repair failed:", repairError.message);
                  console.error("Sending error back to LLM for retry...");

                  // Send error back to LLM so it can retry with simpler approach
                  socket.emit("chat_error", {
                    error: "Tool use failed due to JSON formatting",
                    details: `The generated JSX code contains characters that break JSON encoding. Please simplify the component and avoid complex text with quotes or special characters. Error: ${repairError.message}`,
                    retry: true,
                  });
                  return;
                }
              }

              console.log("Emitting dynamic component update:", args);

              // Emit the dynamic component code back to the client
              socket.emit("dynamic_component_update", {
                code: args.code,
                toolCallId: toolCall.id,
              });

              // Add tool response for LLM continuation
              toolResponses.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: "Dynamic component successfully created and rendered",
              });
            } catch (parseError) {
              console.error("Error parsing dynamic component:", parseError);
            }
          }
        }
      }

      // If we have tool responses, make a second call to LLM with the tool results
      if (toolResponses.length > 0) {
        console.log(
          "Making follow-up call to LLM with tool responses:",
          toolResponses
        );

        // Build conversation with tool call and responses
        const followUpMessages = [
          ...cleanMessages,
          {
            role: "assistant",
            content: aiMessage.content || "", // Ensure content is never null/undefined
            tool_calls: aiMessage.tool_calls,
          },
          ...toolResponses,
        ];

        const followUpRequestBody = {
          model: groqModel,
          messages: followUpMessages,
          ...LLM_CONFIG,
        };

        console.log(
          "Sending follow-up request to Groq:",
          JSON.stringify(followUpRequestBody, null, 2)
        );

        const followUpResponse = await fetch(
          `${LLM_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LLM_API_KEY}`,
            },
            body: JSON.stringify(followUpRequestBody),
          }
        );

        if (!followUpResponse.ok) {
          const errorText = await followUpResponse.text();
          console.error(
            "Groq follow-up API error:",
            followUpResponse.status,
            errorText
          );

          // Handle rate limiting in follow-up call
          if (followUpResponse.status === 429) {
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: { message: errorText } };
            }

            // Parse retry time from error message
            const retryMatch = errorData.error?.message?.match(
              /try again in (\d+)m(\d+(?:\.\d+)?)s/
            );
            let retryAfterSeconds = 60; // Default to 60 seconds if we can't parse

            if (retryMatch) {
              const minutes = parseInt(retryMatch[1]);
              const seconds = parseFloat(retryMatch[2]);
              retryAfterSeconds = minutes * 60 + seconds;
            }

            // Emit rate limit info to client
            socket.emit("rate_limit", {
              retryAfter: retryAfterSeconds,
              message: errorData.error?.message,
              limit: errorData.error?.message?.match(/Limit (\d+)/)?.[1],
              used: errorData.error?.message?.match(/Used (\d+)/)?.[1],
              requested:
                errorData.error?.message?.match(/Requested (\d+)/)?.[1],
            });

            console.log(
              `Follow-up call rate limited. Retrying in ${retryAfterSeconds} seconds...`
            );

            // Wait and retry automatically
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfterSeconds * 1000)
            );

            console.log("Retrying follow-up request after rate limit wait...");

            // Retry the follow-up request
            const retryFollowUpResponse = await fetch(
              `${LLM_BASE_URL}/chat/completions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${LLM_API_KEY}`,
                },
                body: JSON.stringify(followUpRequestBody),
              }
            );

            if (!retryFollowUpResponse.ok) {
              const retryErrorText = await retryFollowUpResponse.text();
              console.error(
                "Follow-up retry failed:",
                retryFollowUpResponse.status,
                retryErrorText
              );
              throw new Error(
                `Follow-up retry failed: ${retryFollowUpResponse.status} ${retryFollowUpResponse.statusText} - ${retryErrorText}`
              );
            }

            // Use retry response instead
            const retryFollowUpData = await retryFollowUpResponse.json();
            socket.emit("retry_success", {
              message: "Follow-up request succeeded after rate limit wait",
            });

            const finalMessage = retryFollowUpData.choices[0].message;

            socket.emit("chat_response", {
              content: finalMessage.content || "",
              tool_calls: [],
            });
            return; // Exit after successful retry
          }

          throw new Error(
            `Follow-up API error: ${followUpResponse.status} ${followUpResponse.statusText} - ${errorText}`
          );
        }

        const followUpData = await followUpResponse.json();
        const finalMessage = followUpData.choices[0].message;

        console.log("Groq follow-up response:", finalMessage);

        // Emit the final response with context from tool execution
        socket.emit("chat_response", {
          content: finalMessage.content || "",
          tool_calls: [],
        });
      } else {
        // No tool calls, emit the original response
        socket.emit("chat_response", {
          content: aiMessage.content || "",
          tool_calls: aiMessage.tool_calls || [],
        });
      }
    } catch (error) {
      console.error("Groq WebSocket error:", error);
      socket.emit("chat_error", {
        error: "Failed to get response from Groq",
        details: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Get available models from Groq
app.get("/api/models", async (req, res) => {
  console.log("📡 Models API called");
  try {
    if (!LLM_API_KEY) {
      console.log("❌ No API key configured");
      return res.status(500).json({
        error: "API key not configured",
        details: "LLM_API_KEY environment variable is not set",
      });
    }

    console.log("🔑 API key found, calling Groq models API...");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const response = await fetch(`${LLM_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
    });

    console.log("📊 Groq models API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Groq models API error:", response.status, errorText);
      throw new Error(
        `Models API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("✅ Received models:", data.data?.length || 0, "models");

    // Filter for models that support tools (exclude guard/prompt models)
    const toolCapableModels = data.data.filter(
      (model) =>
        (model.id.includes("llama") ||
          model.id.includes("mixtral") ||
          model.id.includes("gemma") ||
          model.id.includes("deepseek")) &&
        !model.id.includes("guard") &&
        !model.id.includes("prompt-guard") &&
        model.max_completion_tokens >= 4096 // Ensure decent output length
    );

    console.log("🛠️  Tool-capable models:", toolCapableModels.length);

    // Find the best available model (prefer 70b models, then newer versions)
    const bestModel =
      toolCapableModels.find((m) => m.id === "llama-3.3-70b-versatile") ||
      toolCapableModels.find((m) => m.id === "deepseek-r1-distill-llama-70b") ||
      toolCapableModels.find((m) => m.id.includes("70b")) ||
      toolCapableModels.find((m) => m.id.includes("32b")) ||
      toolCapableModels.find((m) => m.id === "llama-3.1-8b-instant") ||
      toolCapableModels[0];

    res.json({
      models: toolCapableModels,
      recommended: bestModel ? bestModel.id : "llama-3.1-8b-instant",
    });
  } catch (error) {
    console.error("💥 Models API error:", error.message);
    res.status(500).json({
      error: "Failed to fetch models",
      details: error.message,
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Pathweaver server running on http://localhost:${PORT}`);
});
