// This object describes every endpoint in the API: what it expects, what it returns.
// Swagger UI (mounted at /api in index.ts) reads this and renders an interactive
// "try it out" page. Keep this updated as you add new routes.

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Scanr API",
    version: "1.0.0",
    description: "Backend API for the Scanr receipt/invoice scanning app.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the token returned from /auth/login or /auth/signup",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          fullName: { type: "string" },
          email: { type: "string" },
          businessName: { type: "string", nullable: true },
          avatarUrl: { type: "string", nullable: true },
          plan: { type: "string", enum: ["FREE", "PRO", "BUSINESS"] },
          scanLimit: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LineItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          qty: { type: "number" },
          price: { type: "number" },
        },
      },
      Scan: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          fileName: { type: "string" },
          previewUrl: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: ["PROCESSING", "COMPLETE", "REVIEW_REQUIRED", "APPROVED", "DISCARDED", "FAILED"],
          },
          merchantName: { type: "string", nullable: true },
          date: { type: "string", nullable: true },
          currency: { type: "string", nullable: true },
          taxAmount: { type: "number", nullable: true },
          totalAmount: { type: "number", nullable: true },
          confidenceScore: { type: "number", nullable: true },
          documentType: { type: "string", nullable: true },
          qualityScore: { type: "number", nullable: true },
          processingTime: { type: "number", nullable: true },
          failureReason: { type: "string", nullable: true },
          lineItems: { type: "array", items: { $ref: "#/components/schemas/LineItem" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create a new account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "password", "agreedToTerms"],
                properties: {
                  fullName: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 8 },
                  agreedToTerms: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Account created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
          "409": { description: "Email already in use", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } },
        },
        responses: { "200": { description: "Request acknowledged" } },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password using a token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  email: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Password reset" } },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (client discards its token)",
        responses: { "200": { description: "Logged out" } },
      },
    },
    "/user/me": {
      get: {
        tags: ["User"],
        summary: "Get the current user's profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          "401": { description: "Missing or invalid token" },
        },
      },
    },
    "/user/profile": {
      put: {
        tags: ["User"],
        summary: "Update profile fields",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  fullName: { type: "string" },
                  businessName: { type: "string" },
                  avatarUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated profile", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } },
      },
    },
    "/user/notifications": {
      put: {
        tags: ["User"],
        summary: "Update notification preferences",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  scanComplete: { type: "boolean" },
                  weeklyReport: { type: "boolean" },
                  securityAlerts: { type: "boolean" },
                  productUpdates: { type: "boolean" },
                  exportReady: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated preferences" } },
      },
    },
    "/scans": {
      post: {
        tags: ["Scans"],
        summary: "Upload a receipt or invoice for extraction",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Upload accepted, processing started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scanId: { type: "string" },
                    status: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "No file uploaded or invalid file type" },
        },
      },
      get: {
        tags: ["Scans"],
        summary: "List scan history with optional filters",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "dateFrom", in: "query", schema: { type: "string" } },
          { name: "dateTo", in: "query", schema: { type: "string" } },
          { name: "vendor", in: "query", schema: { type: "string" } },
          { name: "totalMin", in: "query", schema: { type: "number" } },
          { name: "totalMax", in: "query", schema: { type: "number" } },
        ],
        responses: {
          "200": {
            description: "Paginated scan history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scans: { type: "array", items: { $ref: "#/components/schemas/Scan" } },
                    totalCount: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/scans/{scanId}": {
      get: {
        tags: ["Scans"],
        summary: "Get full extracted result for a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Scan details", content: { "application/json": { schema: { $ref: "#/components/schemas/Scan" } } } },
          "404": { description: "Scan not found" },
        },
      },
      patch: {
        tags: ["Scans"],
        summary: "Edit extracted fields on a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  merchantName: { type: "string" },
                  date: { type: "string" },
                  currency: { type: "string" },
                  taxAmount: { type: "number" },
                  totalAmount: { type: "number" },
                  lineItems: { type: "array", items: { $ref: "#/components/schemas/LineItem" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated scan", content: { "application/json": { schema: { $ref: "#/components/schemas/Scan" } } } },
          "404": { description: "Scan not found" },
        },
      },
      delete: {
        tags: ["Scans"],
        summary: "Permanently delete a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" }, "404": { description: "Scan not found" } },
      },
    },
    "/scans/{scanId}/status": {
      get: {
        tags: ["Scans"],
        summary: "Poll processing status of a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Current status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scanId: { type: "string" },
                    status: { type: "string" },
                    progress: { type: "integer" },
                    date: { type: "string", nullable: true, description: "Extracted invoice date, once available" },
                    time: { type: "string", format: "date-time", description: "When the scan was uploaded" },
                    category: { type: "string", nullable: true, description: "Document type, once available" },
                    totalAmount: { type: "number", nullable: true, description: "Extracted total, once available" },
                    message: { type: "string", nullable: true, description: "Present only when status is 'failed'" },
                  },
                },
              },
            },
          },
          "404": { description: "Scan not found" },
        },
      },
    },
    "/scans/{scanId}/approve": {
      post: {
        tags: ["Scans"],
        summary: "Approve and save a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Approved" }, "404": { description: "Scan not found" } },
      },
    },
    "/scans/{scanId}/discard": {
      post: {
        tags: ["Scans"],
        summary: "Discard a scan",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Discarded" }, "404": { description: "Scan not found" } },
      },
    },
  },
};