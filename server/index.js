import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

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

// Model fallback priority list - dynamically populated at startup
let MODEL_FALLBACK_LIST = [
  "llama-3.3-70b-versatile", // Fallback if API fetch fails
  "llama-3.1-8b-instant",
];

// Fetch available models and build dynamic fallback list
async function initializeModelFallbackList() {
  try {
    console.log("🔄 Fetching available models from Groq...");

    const response = await fetch(`${LLM_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Models API returned ${response.status}`);
    }

    const data = await response.json();

    // Filter for tool-capable models (exclude guard/prompt models)
    const toolCapableModels = data.data.filter(
      (model) =>
        (model.id.includes("llama") ||
          model.id.includes("mixtral") ||
          model.id.includes("gemma") ||
          model.id.includes("deepseek")) &&
        !model.id.includes("guard") &&
        !model.id.includes("prompt-guard") &&
        model.max_completion_tokens >= 4096
    );

    if (toolCapableModels.length === 0) {
      throw new Error("No tool-capable models found");
    }

    // Sort models by size/capability for optimal fallback order
    const sortedModels = toolCapableModels.sort((a, b) => {
      // Prefer larger models first, then smaller ones
      const sizeA = parseInt(a.id.match(/(\d+)b/)?.[1] || "0");
      const sizeB = parseInt(b.id.match(/(\d+)b/)?.[1] || "0");
      return sizeB - sizeA; // Descending order
    });

    // Build fallback list: best model, then smallest models, then mid-range
    const best70b = sortedModels.find(
      (m) => m.id.includes("70b") && m.id.includes("3.3")
    );
    const best8b = sortedModels.find(
      (m) => m.id.includes("8b") && m.id.includes("instant")
    );
    const otherSmall = sortedModels.filter((m) => {
      const size = parseInt(m.id.match(/(\d+)b/)?.[1] || "0");
      return size <= 9 && m.id !== best8b?.id;
    });
    const other70b = sortedModels.filter(
      (m) => m.id.includes("70b") && m.id !== best70b?.id
    );

    MODEL_FALLBACK_LIST = [
      best70b?.id,
      best8b?.id,
      ...otherSmall.slice(0, 2).map((m) => m.id),
      ...other70b.slice(0, 1).map((m) => m.id),
    ].filter(Boolean); // Remove any undefined values

    console.log("✅ Dynamic fallback list built:", MODEL_FALLBACK_LIST);

    return MODEL_FALLBACK_LIST;
  } catch (error) {
    console.error(
      "⚠️  Failed to fetch models, using default fallback list:",
      error.message
    );
    // Keep the default fallback list defined above
    return MODEL_FALLBACK_LIST;
  }
}

// Helper function to get next model in fallback list
function getNextModel(currentModel) {
  const currentIndex = MODEL_FALLBACK_LIST.indexOf(currentModel);
  if (currentIndex === -1 || currentIndex >= MODEL_FALLBACK_LIST.length - 1) {
    // If we're at the end of the list or model not found, return null
    return null;
  }
  return MODEL_FALLBACK_LIST[currentIndex + 1];
}

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

      // Start with the best model, or use the provided model if it's in our fallback list
      let currentModel =
        model && MODEL_FALLBACK_LIST.includes(model)
          ? model
          : MODEL_FALLBACK_LIST[0];

      console.log("Received WebSocket chat request:", {
        messagesCount: messages.length,
        toolCount: tools.length,
        requestedModel: model,
        usingModel: currentModel,
        fallbackList: MODEL_FALLBACK_LIST,
      });

      // Clean messages to only include role and content (Groq doesn't support id/timestamp)
      const cleanMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const requestBody = {
        model: currentModel,
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

      let response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      // Parse and emit rate limit headers if present
      const rateLimitHeaders = {
        limitRequests: response.headers.get("x-ratelimit-limit-requests"),
        limitTokens: response.headers.get("x-ratelimit-limit-tokens"),
        remainingRequests: response.headers.get(
          "x-ratelimit-remaining-requests"
        ),
        remainingTokens: response.headers.get("x-ratelimit-remaining-tokens"),
        resetRequests: response.headers.get("x-ratelimit-reset-requests"),
        resetTokens: response.headers.get("x-ratelimit-reset-tokens"),
      };

      // Emit rate limit status if we have header data
      if (
        rateLimitHeaders.remainingRequests ||
        rateLimitHeaders.remainingTokens
      ) {
        const remainingReqs = parseInt(rateLimitHeaders.remainingRequests) || 0;
        const limitReqs = parseInt(rateLimitHeaders.limitRequests) || 1;
        const remainingTokens = parseInt(rateLimitHeaders.remainingTokens) || 0;
        const limitTokens = parseInt(rateLimitHeaders.limitTokens) || 1;

        const requestsPercentage = (remainingReqs / limitReqs) * 100;
        const tokensPercentage = (remainingTokens / limitTokens) * 100;

        // Warn when capacity is low (< 20%)
        const isLowCapacity = requestsPercentage < 20 || tokensPercentage < 20;

        socket.emit("rate_limit_status", {
          model: currentModel,
          limits: {
            requests: limitReqs,
            tokens: limitTokens,
          },
          remaining: {
            requests: remainingReqs,
            tokens: remainingTokens,
          },
          percentage: {
            requests: requestsPercentage,
            tokens: tokensPercentage,
          },
          resetTime: {
            requests: rateLimitHeaders.resetRequests,
            tokens: rateLimitHeaders.resetTokens,
          },
          warning: isLowCapacity,
        });
      }

      // Handle rate limiting with smart retry
      if (!response.ok) {
        if (response.status === 429) {
          const errorText = await response.text();
          console.error("Groq API error response:", response.status, errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: { message: errorText } };
          }

          // Try to switch to next model in fallback list
          const nextModel = getNextModel(currentModel);

          if (nextModel) {
            console.log(
              `Rate limited on ${currentModel}. Switching to fallback model: ${nextModel}`
            );

            // Update the request body with new model
            requestBody.model = nextModel;
            currentModel = nextModel;

            // Emit model switch info to client
            socket.emit("rate_limit", {
              retryAfter: 0,
              message: `Switching to fallback model: ${nextModel}`,
              currentModel: nextModel,
              switchedModel: true,
            });

            // Retry immediately with new model
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
                "Fallback model failed:",
                retryResponse.status,
                retryErrorText
              );

              // If fallback also hits rate limit, try the next one recursively
              if (retryResponse.status === 429) {
                let retryErrorData;
                try {
                  retryErrorData = JSON.parse(retryErrorText);
                } catch (e) {
                  retryErrorData = { error: { message: retryErrorText } };
                }

                const nextNextModel = getNextModel(nextModel);
                if (nextNextModel) {
                  console.log(
                    `Fallback ${nextModel} also rate limited. Trying ${nextNextModel}`
                  );
                  requestBody.model = nextNextModel;
                  currentModel = nextNextModel;

                  socket.emit("rate_limit", {
                    retryAfter: 0,
                    message: `Switching to fallback model: ${nextNextModel}`,
                    currentModel: nextNextModel,
                    switchedModel: true,
                  });

                  const finalRetryResponse = await fetch(
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

                  if (!finalRetryResponse.ok) {
                    const finalErrorText = await finalRetryResponse.text();
                    let finalErrorData;
                    try {
                      finalErrorData = JSON.parse(finalErrorText);
                    } catch (e) {
                      finalErrorData = { error: { message: finalErrorText } };
                    }

                    // All models exhausted - collect wait times
                    const waitTimes = [];

                    // Parse wait times from all error messages
                    for (const errData of [
                      errorData,
                      retryErrorData,
                      finalErrorData,
                    ]) {
                      const retryMatch = errData.error?.message?.match(
                        /try again in (\d+)m(\d+(?:\.\d+)?)s/
                      );
                      if (retryMatch) {
                        const minutes = parseInt(retryMatch[1]);
                        const seconds = parseFloat(retryMatch[2]);
                        waitTimes.push(minutes * 60 + seconds);
                      }
                    }

                    const minWait =
                      waitTimes.length > 0 ? Math.min(...waitTimes) : 60;
                    const maxWait =
                      waitTimes.length > 0 ? Math.max(...waitTimes) : 60;

                    const formatTime = (seconds) => {
                      const mins = Math.floor(seconds / 60);
                      const secs = Math.floor(seconds % 60);
                      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    };

                    socket.emit("chat_error", {
                      error: "All models are currently rate-limited",
                      details: `All available models have hit their rate limits. Please try again in ${formatTime(
                        minWait
                      )}${
                        maxWait > minWait ? ` to ${formatTime(maxWait)}` : ""
                      }.`,
                      retryAfter: minWait,
                    });
                    return;
                  }

                  const finalRetryData = await finalRetryResponse.json();
                  socket.emit("retry_success", {
                    message: `Request succeeded with fallback model: ${nextNextModel}`,
                    modelUsed: nextNextModel,
                  });

                  const aiMessage = finalRetryData.choices[0].message;
                  // Continue with processing (code will fall through to normal flow)
                  const retryData = finalRetryData;
                } else {
                  // Parse wait time from the second fallback's error
                  const retryMatch = retryErrorData.error?.message?.match(
                    /try again in (\d+)m(\d+(?:\.\d+)?)s/
                  );
                  let retrySeconds = 60;
                  if (retryMatch) {
                    const minutes = parseInt(retryMatch[1]);
                    const seconds = parseFloat(retryMatch[2]);
                    retrySeconds = minutes * 60 + seconds;
                  }

                  const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                  };

                  socket.emit("chat_error", {
                    error: "All models are currently rate-limited",
                    details: `All available fallback models have hit their rate limits. Please try again in approximately ${formatTime(
                      retrySeconds
                    )}.`,
                    retryAfter: retrySeconds,
                  });
                  return;
                }
              } else {
                throw new Error(
                  `Fallback model failed: ${retryResponse.status} ${retryResponse.statusText} - ${retryErrorText}`
                );
              }
            } else {
              console.log("Fallback model response received:", {
                model: nextModel,
                hasContent: !!retryResponse.ok,
              });

              socket.emit("retry_success", {
                message: `Request succeeded with fallback model: ${nextModel}`,
                modelUsed: nextModel,
              });

              // Use the retry response for normal processing
              response = retryResponse;
            }
          } else {
            // No more fallback models, wait for rate limit to clear
            const retryMatch = errorData.error?.message?.match(
              /try again in (\d+)m(\d+(?:\.\d+)?)s/
            );
            let retryAfterSeconds = 60;

            if (retryMatch) {
              const minutes = parseInt(retryMatch[1]);
              const seconds = parseFloat(retryMatch[2]);
              retryAfterSeconds = minutes * 60 + seconds;
            }

            socket.emit("rate_limit", {
              retryAfter: retryAfterSeconds,
              message: errorData.error?.message,
              limit: errorData.error?.message?.match(/Limit (\d+)/)?.[1],
              used: errorData.error?.message?.match(/Used (\d+)/)?.[1],
              requested:
                errorData.error?.message?.match(/Requested (\d+)/)?.[1],
            });

            console.log(
              `Rate limited on all models. Waiting ${retryAfterSeconds} seconds...`
            );

            await new Promise((resolve) =>
              setTimeout(resolve, retryAfterSeconds * 1000)
            );

            console.log("Retrying request after rate limit wait...");

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
                "Final retry failed:",
                retryResponse.status,
                retryErrorText
              );
              throw new Error(
                `Final retry failed: ${retryResponse.status} ${retryResponse.statusText} - ${retryErrorText}`
              );
            }

            const retryData = await retryResponse.json();
            socket.emit("retry_success", {
              message: "Request succeeded after rate limit wait",
            });

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
                        console.error(
                          "JSON repair failed:",
                          repairError.message
                        );
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
                    console.error(
                      "Error parsing dynamic component:",
                      parseError
                    );
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
                model: currentModel,
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
        } else {
          // Non-429 error
          const errorText = await response.text();
          throw new Error(
            `API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
      }

      const responseData = await response.json();

      // Handle empty or error responses
      if (!responseData.choices || responseData.choices.length === 0) {
        throw new Error("No response from AI model");
      }

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

              // Emit the dynamic component code back to the client with model name
              socket.emit("dynamic_component_update", {
                code: args.code,
                toolCallId: toolCall.id,
                modelName: currentModel,
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
          model: currentModel,
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

          // Handle rate limiting in follow-up call with model fallback
          if (followUpResponse.status === 429) {
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: { message: errorText } };
            }

            // Try to switch to next model in fallback list
            const nextModel = getNextModel(currentModel);

            if (nextModel) {
              console.log(
                `Follow-up call rate limited on ${currentModel}. Switching to fallback model: ${nextModel}`
              );

              followUpRequestBody.model = nextModel;
              currentModel = nextModel;

              socket.emit("rate_limit", {
                retryAfter: 0,
                message: `Follow-up switching to fallback model: ${nextModel}`,
                currentModel: nextModel,
                switchedModel: true,
              });

              // Retry with fallback model
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
                  "Follow-up fallback failed:",
                  retryFollowUpResponse.status,
                  retryErrorText
                );
                throw new Error(
                  `Follow-up fallback failed: ${retryFollowUpResponse.status} ${retryFollowUpResponse.statusText}`
                );
              }

              const retryFollowUpData = await retryFollowUpResponse.json();
              socket.emit("retry_success", {
                message: `Follow-up request succeeded with fallback model: ${nextModel}`,
                modelUsed: nextModel,
              });

              const finalMessage = retryFollowUpData.choices[0].message;

              socket.emit("chat_response", {
                content: finalMessage.content || "",
                tool_calls: [],
              });
              return;
            } else {
              // No more fallback models, wait for rate limit
              const retryMatch = errorData.error?.message?.match(
                /try again in (\d+)m(\d+(?:\.\d+)?)s/
              );
              let retryAfterSeconds = 60;

              if (retryMatch) {
                const minutes = parseInt(retryMatch[1]);
                const seconds = parseFloat(retryMatch[2]);
                retryAfterSeconds = minutes * 60 + seconds;
              }

              socket.emit("rate_limit", {
                retryAfter: retryAfterSeconds,
                message: errorData.error?.message,
                limit: errorData.error?.message?.match(/Limit (\d+)/)?.[1],
                used: errorData.error?.message?.match(/Used (\d+)/)?.[1],
                requested:
                  errorData.error?.message?.match(/Requested (\d+)/)?.[1],
              });

              console.log(
                `Follow-up call rate limited. Waiting ${retryAfterSeconds} seconds...`
              );

              await new Promise((resolve) =>
                setTimeout(resolve, retryAfterSeconds * 1000)
              );

              console.log(
                "Retrying follow-up request after rate limit wait..."
              );

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
                  `Follow-up retry failed: ${retryFollowUpResponse.status} ${retryFollowUpResponse.statusText}`
                );
              }

              const retryFollowUpData = await retryFollowUpResponse.json();
              socket.emit("retry_success", {
                message: "Follow-up request succeeded after rate limit wait",
              });

              const finalMessage = retryFollowUpData.choices[0].message;

              socket.emit("chat_response", {
                content: finalMessage.content || "",
                tool_calls: [],
              });
              return;
            }
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

      // Handle tool_use_failed errors with automatic retry (don't show to user)
      if (error.message.includes("tool_use_failed")) {
        console.log(
          "Tool use failed - emitting retry signal to client for automatic retry"
        );
        socket.emit("chat_error", {
          error: "Tool formatting issue",
          details: error.message,
          retry: true,
        });
        return;
      }

      let errorMessage = "Failed to get response from AI";
      let errorDetails = error.message;

      // Better error messages for common issues
      if (error.message.includes("400")) {
        errorMessage = "Invalid request to AI service";
        errorDetails =
          "The request format was invalid. This is usually a temporary issue - please try again.";
      } else if (
        error.message.includes("401") ||
        error.message.includes("403")
      ) {
        errorMessage = "API authentication failed";
        errorDetails = "Please check your API key configuration.";
      } else if (error.message.includes("404")) {
        errorMessage = "AI model not found";
        errorDetails =
          "The requested AI model may not be available. Try using a different model.";
      } else if (
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503")
      ) {
        errorMessage = "AI service temporarily unavailable";
        errorDetails =
          "The AI service is experiencing issues. Please try again in a moment.";
      }

      socket.emit("chat_error", {
        error: errorMessage,
        details: errorDetails,
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

// Initialize model fallback list before starting server
initializeModelFallbackList().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Pathweaver server running on http://localhost:${PORT}`);
  });
});
