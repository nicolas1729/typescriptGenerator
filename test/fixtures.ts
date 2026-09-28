// Spécifications de test partagées entre les tests Node et navigateur.

export const openapi3 = {
  openapi: "3.0.3",
  info: { title: "Démo Boutique", version: "1.2.0" },
  paths: {
    "/pets/{id}": {
      get: {
        operationId: "getPet",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          status: { type: "string", enum: ["available", "sold"] },
        },
      },
    },
  },
};

export const swagger2 = {
  swagger: "2.0",
  info: { title: "Legacy", version: "0.1" },
  host: "example.com",
  basePath: "/v1",
  paths: {
    "/users": {
      get: {
        produces: ["application/json"],
        responses: { "200": { description: "ok", schema: { type: "array", items: { $ref: "#/definitions/User" } } } },
      },
    },
  },
  definitions: {
    User: { type: "object", required: ["email"], properties: { email: { type: "string" }, age: { type: "integer" } } },
  },
};
